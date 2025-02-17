import React, { useEffect } from 'react';
import { format, addDays, startOfWeek } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";

const TIMES = ["7:30", "8:30", "9:45", "11:00", "12:30", "14:00", "15:30", "16:45"];

interface WeeklyGridProps {
  selectedDate: Date;
}

interface Availability {
  id: string;
  pilot_id: string;
  day: string;
  time_slot: string;
}

const WeeklyGrid = ({ selectedDate }: WeeklyGridProps) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log('WeeklyGrid mounted', { user, profile, selectedDate });
    return () => {
      console.log('WeeklyGrid unmounting');
    };
  }, [user, profile, selectedDate]);

  const startDate = startOfWeek(selectedDate, { weekStartsOn: 1 });
  
  const DAYS = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(startDate, index);
    return {
      fullName: format(date, "EEEE"),
      displayDate: format(date, "EEE MMM d").toUpperCase(),
      date: format(date, "yyyy-MM-dd")
    };
  });

  const { data: availabilities = [], status: queryStatus, error: queryError } = useQuery({
    queryKey: ['pilot-availability', startDate],
    queryFn: async () => {
      console.log('Fetching availability data for week starting:', startDate);
      const { data, error } = await supabase
        .from('pilot_availability')
        .select('*')
        .gte('day', DAYS[0].date)
        .lte('day', DAYS[6].date);

      if (error) {
        console.error('Error fetching availability:', error);
        throw error;
      }
      console.log('Fetched availability data:', data);
      return data as Availability[];
    },
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    console.log('Query status changed:', { queryStatus, queryError, availabilitiesCount: availabilities?.length });
  }, [queryStatus, queryError, availabilities]);

  const createAvailability = useMutation({
    mutationFn: async ({ day, timeSlot }: { day: string; timeSlot: string }) => {
      console.log('Creating availability:', { day, timeSlot });
      const { error } = await supabase
        .from('pilot_availability')
        .insert([
          {
            pilot_id: user?.id,
            day,
            time_slot: timeSlot,
          },
        ]);

      if (error) {
        console.error('Error creating availability:', error);
        throw error;
      }
    },
    onMutate: async ({ day, timeSlot }) => {
      console.log('Starting optimistic update for create:', { day, timeSlot });
      await queryClient.cancelQueries({ queryKey: ['pilot-availability'] });
      const previousAvailabilities = queryClient.getQueryData(['pilot-availability']) || [];
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      
      queryClient.setQueryData(['pilot-availability'], (old: Availability[] = []) => {
        const newAvailability = {
          id: tempId,
          pilot_id: user?.id!,
          day,
          time_slot: timeSlot,
        };
        return [...old, newAvailability];
      });

      return { previousAvailabilities };
    },
    onSuccess: () => {
      console.log('Availability created successfully');
    },
    onError: (err, variables, context) => {
      console.error('Error in create mutation:', err);
      queryClient.setQueryData(['pilot-availability'], context?.previousAvailabilities);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update availability. Please try again.",
      });
    },
    onSettled: () => {
      console.log('Create mutation settled, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['pilot-availability'] });
    },
  });

  const deleteAvailability = useMutation({
    mutationFn: async ({ day, timeSlot }: { day: string; timeSlot: string }) => {
      console.log('Deleting availability:', { day, timeSlot });
      const { error } = await supabase
        .from('pilot_availability')
        .delete()
        .match({
          pilot_id: user?.id,
          day,
          time_slot: timeSlot,
        });

      if (error) {
        console.error('Error deleting availability:', error);
        throw error;
      }
    },
    onMutate: async ({ day, timeSlot }) => {
      console.log('Starting optimistic update for delete:', { day, timeSlot });
      await queryClient.cancelQueries({ queryKey: ['pilot-availability'] });
      const previousAvailabilities = queryClient.getQueryData(['pilot-availability']) || [];

      queryClient.setQueryData(['pilot-availability'], (old: Availability[] = []) => {
        return old.filter(a => !(a.day === day && a.time_slot === timeSlot && a.pilot_id === user?.id));
      });

      return { previousAvailabilities };
    },
    onSuccess: () => {
      console.log('Availability deleted successfully');
    },
    onError: (err, variables, context) => {
      console.error('Error in delete mutation:', err);
      queryClient.setQueryData(['pilot-availability'], context?.previousAvailabilities);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update availability. Please try again.",
      });
    },
    onSettled: () => {
      console.log('Delete mutation settled, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['pilot-availability'] });
    },
  });

  const handleAvailabilityToggle = (day: string, timeSlot: string) => {
    console.log('Handling availability toggle:', { day, timeSlot, user: user?.id });
    if (!user?.id) {
      console.error('No user ID available for availability toggle');
      return;
    }

    const isCurrentlyAvailable = availabilities.some(
      (a) => a.day === day && a.time_slot === timeSlot && a.pilot_id === user?.id
    );
    
    console.log('Current availability status:', { isCurrentlyAvailable });

    if (isCurrentlyAvailable) {
      deleteAvailability.mutate({ day, timeSlot });
    } else {
      createAvailability.mutate({ day, timeSlot });
    }
  };

  const handleDayToggle = (day: string) => {
    console.log('Handling day toggle:', { day, user: user?.id });
    if (!user?.id) {
      console.error('No user ID available for day toggle');
      return;
    }

    const dayAvailabilities = availabilities.filter(
      (a) => a.day === day && a.pilot_id === user?.id
    );

    const shouldMakeAvailable = dayAvailabilities.length < TIMES.length;
    console.log('Day toggle status:', { shouldMakeAvailable, currentAvailabilities: dayAvailabilities.length });

    if (shouldMakeAvailable) {
      const unavailableTimeSlots = TIMES.filter(
        time => !dayAvailabilities.some(a => a.time_slot === time)
      );
      
      console.log('Adding availability for time slots:', unavailableTimeSlots);
      unavailableTimeSlots.forEach(timeSlot => {
        createAvailability.mutate({ day, timeSlot });
      });
    } else {
      console.log('Removing availability for all time slots');
      dayAvailabilities.forEach(availability => {
        deleteAvailability.mutate({ 
          day: availability.day, 
          timeSlot: availability.time_slot 
        });
      });
    }
  };

  const isPilot = profile?.role === 'pilot';
  
  useEffect(() => {
    console.log('Pilot status:', { isPilot, profileRole: profile?.role });
  }, [isPilot, profile]);

  return (
    <div className="mt-8 overflow-x-auto pb-4">
      <div className="min-w-[1000px]">
        <div className="grid grid-cols-[120px_1fr] gap-4">
          <div className="font-semibold mb-2">
            Take-off Time
          </div>
          
          <div className="grid grid-cols-7 gap-4">
            {DAYS.map((day) => (
              <div 
                key={day.fullName}
                className="text-center font-semibold mb-2 cursor-pointer"
                onClick={() => isPilot && handleDayToggle(day.date)}
              >
                <div>{day.displayDate}</div>
              </div>
            ))}
          </div>

          {TIMES.map((time) => (
            <React.Fragment key={time}>
              <div className="py-2 font-medium text-muted-foreground">
                {time}
              </div>

              <div className="grid grid-cols-7 gap-4">
                {DAYS.map((day) => {
                  const isAvailable = availabilities.some(
                    (a) => a.day === day.date && a.time_slot === time && a.pilot_id === user?.id
                  );
                  
                  return (
                    <div 
                      key={`${day.date}-${time}`} 
                      className="min-h-[40px]"
                      onClick={() => isPilot && handleAvailabilityToggle(day.date, time)}
                    >
                      {isAvailable && (
                        <div className="bg-green-500/20 text-green-700 rounded-lg p-2 text-sm font-medium text-center cursor-pointer hover:bg-green-500/30">
                          Available
                        </div>
                      )}
                      {!isAvailable && isPilot && (
                        <div className="bg-red-500/10 text-red-700 rounded-lg p-2 text-sm font-medium text-center cursor-pointer hover:bg-red-500/20">
                          Unavailable
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeeklyGrid;
