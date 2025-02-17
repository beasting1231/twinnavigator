import React from 'react';
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

  // Get the start of the week containing the selected date (Monday)
  const startDate = startOfWeek(selectedDate, { weekStartsOn: 1 });
  
  // Generate array of 7 days starting from Monday
  const DAYS = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(startDate, index);
    return {
      fullName: format(date, "EEEE"),
      displayDate: format(date, "EEE MMM d").toUpperCase(),
      date: format(date, "yyyy-MM-dd")
    };
  });

  // Fetch availability data
  const { data: availabilities = [] } = useQuery({
    queryKey: ['pilot-availability', startDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pilot_availability')
        .select('*')
        .gte('day', DAYS[0].date)
        .lte('day', DAYS[6].date);

      if (error) throw error;
      return data as Availability[];
    },
  });

  // Create availability mutation
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pilot-availability'] });
      toast({
        title: "Availability updated",
        description: "Your availability has been saved.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update availability. Please try again.",
      });
      console.error('Error creating availability:', error);
    },
  });

  // Delete availability mutation
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pilot-availability'] });
      toast({
        title: "Availability updated",
        description: "Your availability has been removed.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update availability. Please try again.",
      });
      console.error('Error deleting availability:', error);
    },
  });

  const handleAvailabilityToggle = (day: string, timeSlot: string) => {
    const isCurrentlyAvailable = availabilities.some(
      (a) => a.day === day && a.time_slot === timeSlot && a.pilot_id === user?.id
    );

    if (isCurrentlyAvailable) {
      deleteAvailability.mutate({ day, timeSlot });
    } else {
      createAvailability.mutate({ day, timeSlot });
    }
  };

  const handleDayToggle = (day: string) => {
    const dayAvailabilities = availabilities.filter(
      (a) => a.day === day && a.pilot_id === user?.id
    );

    // If all time slots are available, make them all unavailable
    // Otherwise, make all unavailable slots available
    const shouldMakeAvailable = dayAvailabilities.length < TIMES.length;

    if (shouldMakeAvailable) {
      // Find time slots that aren't already available
      const unavailableTimeSlots = TIMES.filter(
        time => !dayAvailabilities.some(a => a.time_slot === time)
      );
      
      // Make all unavailable slots available
      unavailableTimeSlots.forEach(timeSlot => {
        createAvailability.mutate({ day, timeSlot });
      });
    } else {
      // Make all slots unavailable
      dayAvailabilities.forEach(availability => {
        deleteAvailability.mutate({ 
          day: availability.day, 
          timeSlot: availability.time_slot 
        });
      });
    }
  };

  // Check if the current user is a pilot
  const isPilot = profile?.role === 'pilot';

  return (
    <div className="mt-8 overflow-x-auto pb-4">
      <div className="min-w-[1000px]">
        <div className="grid grid-cols-[120px_1fr] gap-4">
          {/* Time column headers */}
          <div className="font-semibold mb-2">
            Take-off Time
          </div>
          
          {/* Day headers */}
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

          {/* Time slots */}
          {TIMES.map((time) => (
            <React.Fragment key={time}>
              {/* Time label */}
              <div className="py-2 font-medium text-muted-foreground">
                {time}
              </div>

              {/* Available slots for each day */}
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
                        <div className="border-2 border-dashed border-gray-200 rounded-lg p-2 text-sm font-medium text-center text-gray-400 cursor-pointer hover:border-gray-300 hover:text-gray-500">
                          Set Available
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
