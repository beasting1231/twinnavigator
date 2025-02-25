
import React, { useEffect, useCallback } from 'react';
import { format, addDays, startOfWeek } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { RealtimeChannel } from '@supabase/supabase-js';
import { cn } from "@/lib/utils";

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

  const startDate = startOfWeek(selectedDate, { weekStartsOn: 1 });
  
  const DAYS = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(startDate, index);
    return {
      fullName: format(date, "EEEE"),
      displayDate: format(date, "EEE MMM d").toUpperCase(),
      date: format(date, "yyyy-MM-dd")
    };
  });

  useEffect(() => {
    let channel: RealtimeChannel;

    const setupRealtimeSubscription = () => {
      channel = supabase
        .channel('pilot-availability-changes')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'pilot_availability'
          },
          (payload) => {
            console.log('Realtime update received:', payload);
            queryClient.invalidateQueries({
              queryKey: ['pilot-availability', startDate.toISOString()]
            });
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status);
        });
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        console.log('Cleaning up realtime subscription');
        supabase.removeChannel(channel);
      }
    };
  }, [startDate, queryClient]);

  const { data: availabilities = [] } = useQuery({
    queryKey: ['pilot-availability', startDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pilot_availability')
        .select('*')
        .gte('day', DAYS[0].date)
        .lte('day', DAYS[6].date);

      if (error) throw error;
      return data as Availability[];
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['weekly-bookings', startDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .gte('booking_date', DAYS[0].date)
        .lte('booking_date', DAYS[6].date);

      if (error) throw error;
      return data;
    }
  });

  const createAvailability = useMutation({
    mutationFn: async ({ day, timeSlot }: { day: string; timeSlot: string }) => {
      const { error } = await supabase
        .from('pilot_availability')
        .insert([
          {
            pilot_id: user?.id,
            day,
            time_slot: timeSlot,
          },
        ]);

      if (error) throw error;
    },
    onMutate: async ({ day, timeSlot }) => {
      await queryClient.cancelQueries({ 
        queryKey: ['pilot-availability', startDate.toISOString()]
      });
      
      const previousAvailabilities = queryClient.getQueryData(
        ['pilot-availability', startDate.toISOString()]
      ) as Availability[] || [];

      const newAvailability = {
        id: `temp-${day}-${timeSlot}`,
        pilot_id: user?.id!,
        day,
        time_slot: timeSlot,
      };

      queryClient.setQueryData(
        ['pilot-availability', startDate.toISOString()],
        (old: Availability[] = []) => [...old, newAvailability]
      );

      return { previousAvailabilities };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(
        ['pilot-availability', startDate.toISOString()],
        context?.previousAvailabilities
      );
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update availability.",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['pilot-availability', startDate.toISOString()]
      });
    },
  });

  const deleteAvailability = useMutation({
    mutationFn: async ({ day, timeSlot }: { day: string; timeSlot: string }) => {
      const { error } = await supabase
        .from('pilot_availability')
        .delete()
        .match({
          pilot_id: user?.id,
          day,
          time_slot: timeSlot,
        });

      if (error) throw error;
    },
    onMutate: async ({ day, timeSlot }) => {
      await queryClient.cancelQueries({
        queryKey: ['pilot-availability', startDate.toISOString()]
      });

      const previousAvailabilities = queryClient.getQueryData(
        ['pilot-availability', startDate.toISOString()]
      ) as Availability[] || [];

      queryClient.setQueryData(
        ['pilot-availability', startDate.toISOString()],
        (old: Availability[] = []) => 
          old.filter(a => !(a.day === day && a.time_slot === timeSlot && a.pilot_id === user?.id))
      );

      return { previousAvailabilities };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(
        ['pilot-availability', startDate.toISOString()],
        context?.previousAvailabilities
      );
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update availability.",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['pilot-availability', startDate.toISOString()]
      });
    },
  });

  const canSetUnavailable = useCallback((day: string, timeSlot: string) => {
    const booking = bookings.find(b => 
      b.booking_date === day && 
      b.time_slot === timeSlot
    );

    if (!booking) return true;

    const uniqueAvailablePilots = new Set(
      availabilities
        .filter(a => a.day === day && a.time_slot === timeSlot)
        .map(a => a.pilot_id)
    ).size;

    const isPilotAvailable = availabilities.some(
      a => a.day === day && 
          a.time_slot === timeSlot && 
          a.pilot_id === user?.id
    );

    if (isPilotAvailable && uniqueAvailablePilots <= booking.number_of_people) {
      return false;
    }

    return true;
  }, [bookings, availabilities, user?.id]);

  const handleAvailabilityToggle = useCallback((day: string, timeSlot: string) => {
    if (!user?.id) return;

    const isCurrentlyAvailable = availabilities.some(
      (a) => a.day === day && a.time_slot === timeSlot && a.pilot_id === user?.id
    );

    if (isCurrentlyAvailable) {
      if (!canSetUnavailable(day, timeSlot)) {
        toast({
          variant: "destructive",
          title: "Cannot set unavailable",
          description: "There are not enough pilots available for existing bookings in this time slot.",
        });
        return;
      }
      deleteAvailability.mutate({ day, timeSlot });
    } else {
      createAvailability.mutate({ day, timeSlot });
    }
  }, [user?.id, availabilities, createAvailability, deleteAvailability, canSetUnavailable, toast]);

  const handleDayToggle = useCallback((day: string) => {
    if (!user?.id) return;

    const dayAvailabilities = availabilities.filter(
      (a) => a.day === day && a.pilot_id === user?.id
    );

    const shouldMakeAvailable = dayAvailabilities.length < TIMES.length;

    if (shouldMakeAvailable) {
      const unavailableTimeSlots = TIMES.filter(
        time => !dayAvailabilities.some(a => a.time_slot === time)
      );
      
      unavailableTimeSlots.forEach(timeSlot => {
        createAvailability.mutate({ day, timeSlot });
      });
    } else {
      dayAvailabilities.forEach(availability => {
        if (canSetUnavailable(day, availability.time_slot)) {
          deleteAvailability.mutate({ 
            day: availability.day, 
            timeSlot: availability.time_slot 
          });
        } else {
          toast({
            variant: "destructive",
            title: "Cannot set all slots unavailable",
            description: "Some time slots require your availability for existing bookings.",
          });
        }
      });
    }
  }, [user?.id, availabilities, createAvailability, deleteAvailability, canSetUnavailable, toast]);

  const isPilot = profile?.role === 'pilot';

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
                      {isPilot && (
                        <div 
                          className={cn(
                            "rounded-lg p-2 text-sm font-medium text-center cursor-pointer transition-colors",
                            isAvailable 
                              ? "bg-green-500/20 text-green-700 hover:bg-green-500/30" 
                              : "bg-red-500/10 text-red-700 hover:bg-red-500/20"
                          )}
                        >
                          {time}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          ))}
        </div>

        <div className="mt-4 text-center text-muted-foreground">
          Selected Day: {selectedDate.toDateString()}
        </div>
      </div>
    </div>
  );
};

export default WeeklyGrid;
