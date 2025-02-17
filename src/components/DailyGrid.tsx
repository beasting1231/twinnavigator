import React, { useEffect } from 'react';
import { format } from "date-fns";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/components/ui/use-toast";
import BookingModal, { BookingFormData } from './BookingModal';

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

interface Booking {
  id: string;
  name: string;
  pickup_location: string;
  number_of_people: number;
  pilot_id: string;
  tag_id: string | null;
  time_slot: string;
  tags?: {
    color: string;
    name: string;
  } | null;
}

const DailyGrid = ({ selectedDate }: DailyGridProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedSlot, setSelectedSlot] = React.useState<{
    time: string;
    pilotId: string;
  } | null>(null);
  const formattedDate = format(selectedDate, "yyyy-MM-dd");

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);
  
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
            queryClient.invalidateQueries({
              queryKey: ['daily-plan', formattedDate]
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bookings'
          },
          () => {
            queryClient.invalidateQueries({
              queryKey: ['bookings', formattedDate]
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

      return availabilities?.map(avail => ({
        ...avail,
        profiles: avail.profiles || { username: 'Unknown Pilot', id: avail.pilot_id }
      })) as PilotAvailability[];
    },
    enabled: !!user
  });

  const { data: bookingsData } = useQuery({
    queryKey: ['bookings', formattedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          name,
          pickup_location,
          number_of_people,
          pilot_id,
          time_slot,
          tag_id,
          tags (
            color,
            name
          )
        `)
        .eq('booking_date', formattedDate);

      if (error) throw error;
      return data as Booking[];
    }
  });

  const createBooking = useMutation({
    mutationFn: async (data: BookingFormData & { pilotId: string, date: string, timeSlot: string }) => {
      const { error } = await supabase
        .from('bookings')
        .insert([{
          pilot_id: data.pilotId,
          booking_date: data.date,
          time_slot: data.timeSlot,
          name: data.name,
          pickup_location: data.pickup_location,
          number_of_people: data.number_of_people,
          phone: data.phone,
          email: data.email,
          tag_id: data.tag_id || (await getDefaultTagId())
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Booking created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create booking: " + error.message,
      });
    }
  });

  const getDefaultTagId = async () => {
    const { data } = await supabase
      .from('tags')
      .select('id')
      .eq('name', 'TWIN')
      .single();
    
    return data?.id;
  };

  if (!user) {
    return null;
  }

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

  const handleBookingSubmit = async (formData: BookingFormData) => {
    if (!selectedSlot) return;

    await createBooking.mutate({
      ...formData,
      pilotId: selectedSlot.pilotId,
      date: formattedDate,
      timeSlot: selectedSlot.time
    });
    
    setSelectedSlot(null);
  };

  const getTimeSlotData = (time: string) => {
    const slots = availablePilots.map(pilot => {
      const isAvailable = availabilitiesData?.some(
        (a: PilotAvailability) => 
          a.pilot_id === pilot.id && 
          a.time_slot === time
      );
      
      const booking = bookingsData?.find(
        b => b.pilot_id === pilot.id && b.time_slot === time
      );

      const hasAnyAvailability = availabilitiesData?.some(
        (a: PilotAvailability) => a.pilot_id === pilot.id
      );

      return {
        pilot,
        isAvailable,
        hasAnyAvailability,
        booking
      };
    });

    return slots.sort((a, b) => {
      if (a.isAvailable === b.isAvailable) return 0;
      return a.isAvailable ? -1 : 1;
    });
  };

  const getAvailablePilotsCount = (time: string) => {
    return availabilitiesData?.filter(a => a.time_slot === time).length || 0;
  };

  return (
    <div className="mt-8 overflow-x-auto pb-4">
      <div className="min-w-[1000px]">
        <div className="grid grid-cols-[120px_1fr] gap-4">
          <div className="font-semibold mb-2">
            Time
          </div>
          
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

          {TIMES.map((time) => (
            <React.Fragment key={time}>
              <div className="py-2 font-medium text-muted-foreground">
                {time}
              </div>

              <div className="grid grid-cols-4 gap-4">
                {getTimeSlotData(time).map(({ pilot, isAvailable, hasAnyAvailability, booking }) => (
                  <div key={`${pilot.id}-${time}`} className="h-[50px]">
                    {booking ? (
                      <div 
                        className="rounded-lg p-2 text-sm font-medium h-full w-full text-white"
                        style={{ 
                          backgroundColor: booking.tags?.color || '#1EAEDB',
                          cursor: 'default'
                        }}
                      >
                        <div className="text-xs">{booking.name}</div>
                        <div className="text-xs">{booking.pickup_location}</div>
                        <div className="text-xs">{booking.number_of_people} pax</div>
                      </div>
                    ) : isAvailable ? (
                      <div 
                        className="bg-white rounded-lg p-2 text-sm font-medium text-center h-full w-full cursor-pointer hover:bg-gray-50"
                        onClick={() => setSelectedSlot({ time, pilotId: pilot.id })}
                      >
                        Available
                      </div>
                    ) : hasAnyAvailability ? (
                      <div className="bg-gray-700 rounded-lg p-2 text-sm font-medium text-center text-white h-full w-full">
                        No {pilot.name}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </React.Fragment>
          ))}
        </div>

        <div className="mt-4 text-center text-muted-foreground">
          Selected Day: {selectedDay}
        </div>
      </div>

      <BookingModal
        isOpen={!!selectedSlot}
        onClose={() => setSelectedSlot(null)}
        onSubmit={handleBookingSubmit}
        selectedDate={format(selectedDate, "MMM d, yyyy")}
        timeSlot={selectedSlot?.time || ""}
        maxPeople={selectedSlot ? getAvailablePilotsCount(selectedSlot.time) : 1}
      />
    </div>
  );
};

export default DailyGrid;
