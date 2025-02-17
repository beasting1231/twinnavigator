import React, { useEffect } from 'react';
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const TIMES = ["7:30", "8:30", "9:45", "11:00", "12:30", "14:00", "15:30", "16:45"];

interface DailyGridProps {
  selectedDate: Date;
}

interface PilotAvailability {
  id: string;
  pilot_id: string;
  day: string;
  time_slot: string;
  profiles: {
    username: string | null;
    id: string;
  };
}

const DailyGrid = ({ selectedDate }: DailyGridProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const formattedDate = format(selectedDate, "yyyy-MM-dd");

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);
  
  // Set up real-time subscription
  useEffect(() => {
    let channel: RealtimeChannel;

    const setupRealtimeSubscription = () => {
      channel = supabase
        .channel('daily-plan-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pilot_availability'
          },
          () => {
            // Invalidate and refetch queries when we receive any change
            queryClient.invalidateQueries({
              queryKey: ['daily-plan', formattedDate]
            });
          }
        )
        .subscribe();
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [formattedDate, queryClient]);

  // Fetch availabilities and profiles for the selected date
  const { data: availabilitiesData } = useQuery({
    queryKey: ['daily-plan', formattedDate],
    queryFn: async () => {
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data: availabilities, error } = await supabase
        .from('pilot_availability')
        .select(`
          id,
          pilot_id,
          day,
          time_slot,
          profiles!pilot_availability_pilot_id_fkey (
            username,
            id
          )
        `)
        .eq('day', formattedDate);

      if (error) {
        console.error('Error fetching availabilities:', error);
        throw error;
      }

      if (!availabilities) return [];

      return availabilities.map(avail => ({
        ...avail,
        profiles: avail.profiles || { username: 'Unknown Pilot', id: avail.pilot_id }
      })) as PilotAvailability[];
    },
    enabled: !!user // Only run query when user is authenticated
  });

  // If not authenticated, don't render anything
  if (!user) {
    return null;
  }

  // Get unique pilots that have at least one availability slot
  const availablePilots = Array.from(new Set(
    (availabilitiesData || [])
      .map(a => ({
        id: a.pilot_id,
        name: a.profiles.username || 'Unknown Pilot'
      }))
      .filter((pilot, index, self) => 
        index === self.findIndex(p => p.id === pilot.id)
      )
  ));

  const selectedDay = format(selectedDate, "EEEE MMM d").toUpperCase();

  return (
    <div className="mt-8 overflow-x-auto pb-4">
      <div className="min-w-[1000px]">
        <div className="grid grid-cols-[120px_1fr] gap-4">
          {/* Time column header */}
          <div className="font-semibold mb-2">
            Time
          </div>
          
          {/* Pilots header */}
          <div className="grid grid-cols-4 gap-4">
            {availablePilots.map((pilot) => (
              <div 
                key={pilot.id}
                className="text-center font-semibold mb-2"
              >
                <div>{pilot.name}</div>
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

              {/* Available slots for each pilot */}
              <div className="grid grid-cols-4 gap-4">
                {availablePilots.map((pilot) => {
                  const isAvailable = availabilitiesData?.some(
                    (a: PilotAvailability) => 
                      a.pilot_id === pilot.id && 
                      a.time_slot === time
                  );
                  
                  return (
                    <div key={`${pilot.id}-${time}`} className="h-[50px]">
                      {isAvailable && (
                        <div className="bg-gray-300 rounded-lg p-2 text-sm font-medium text-center h-full w-full">
                          &nbsp;
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
          Selected Day: {selectedDay}
        </div>
      </div>
    </div>
  );
};

export default DailyGrid;
