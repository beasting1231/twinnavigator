import React, { useEffect } from 'react';
import { format } from "date-fns";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/components/ui/use-toast";
import BookingModal, { BookingFormData } from './BookingModal';
import EditBookingModal from './EditBookingModal';

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
  time_slot: string;
  tag_id: string | null;
  tags?: {
    color: string;
    name: string;
  } | null;
}

interface Pilot {
  id: string;
  name: string;
}

type SlotType = 
  | { type: 'empty' }
  | { type: 'available'; pilot: Pilot }
  | { type: 'unavailable'; pilot: Pilot }
  | { type: 'booking'; pilot: Pilot; booking: Booking; width: number }
  | { type: 'hidden'; pilot: Pilot };

const DailyGrid = ({ selectedDate }: DailyGridProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedSlot, setSelectedSlot] = React.useState<{
    time: string;
    pilotId: string;
  } | null>(null);
  const [selectedBooking, setSelectedBooking] = React.useState<Booking | null>(null);
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
        .eq('booking_date', formattedDate)
        .order('created_at', { ascending: true });  // Add ordering by creation time

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
          tag_id: data.tag_id
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Booking created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['bookings', formattedDate] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create booking: " + error.message,
      });
    }
  });

  const updateBooking = useMutation({
    mutationFn: async (data: BookingFormData & { id: string }) => {
      const { error } = await supabase
        .from('bookings')
        .update({
          name: data.name,
          pickup_location: data.pickup_location,
          number_of_people: data.number_of_people,
          phone: data.phone,
          email: data.email,
          tag_id: data.tag_id
        })
        .eq('id', data.id);

      if (error) throw error;

      // Return the updated data
      return data;
    },
    onSuccess: (updatedData) => {
      // Update the cache manually to preserve order
      queryClient.setQueryData(['bookings', formattedDate], (oldData: Booking[] | undefined) => {
        if (!oldData) return [];
        return oldData.map(booking => 
          booking.id === updatedData.id 
            ? { ...booking, ...updatedData }
            : booking
        );
      });

      toast({
        title: "Success",
        description: "Booking updated successfully",
      });
      
      setSelectedBooking(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update booking: " + error.message,
      });
    }
  });

  const deleteBooking = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Booking deleted successfully",
      });
      setSelectedBooking(null);
      queryClient.invalidateQueries({ queryKey: ['bookings', formattedDate] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete booking: " + error.message,
      });
    }
  });

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

  const handleUpdateBooking = async (data: BookingFormData) => {
    if (!selectedBooking) return;
    
    await updateBooking.mutate({
      ...data,
      id: selectedBooking.id
    });
    
    setSelectedBooking(null);
  };

  const handleDeleteBooking = async () => {
    if (!selectedBooking) return;
    
    await deleteBooking.mutate(selectedBooking.id);
  };

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

  const getTimeSlotData = (time: string): SlotType[] => {
    const timeBookings = bookingsData?.filter(b => b.time_slot === time) || [];
    
    // Create initial slots array
    let slots: SlotType[] = availablePilots.map(pilot => {
      const isAvailable = availabilitiesData?.some(
        (a: PilotAvailability) => 
          a.pilot_id === pilot.id && 
          a.time_slot === time
      );

      return isAvailable 
        ? { type: 'available' as const, pilot }
        : { type: 'unavailable' as const, pilot };
    });

    // Sort slots to put available slots first
    slots.sort((a, b) => {
      if (a.type === 'available' && b.type === 'unavailable') return -1;
      if (a.type === 'unavailable' && b.type === 'available') return 1;
      return 0;
    });

    // Fill remaining slots if needed
    while (slots.length < 4) {
      slots.push({ type: 'empty' });
    }

    // Keep track of used positions
    let usedPositions = new Set<number>();

    // Process bookings in order
    timeBookings.forEach(booking => {
      const width = Math.min(booking.number_of_people, 4);
      
      // Find the first available position that can fit the booking
      let availableIndex = -1;
      for (let i = 0; i <= slots.length - width; i++) {
        let canFit = true;
        // Check if any position in the range is already used
        for (let j = 0; j < width; j++) {
          if (usedPositions.has(i + j)) {
            canFit = false;
            break;
          }
        }
        if (canFit) {
          availableIndex = i;
          break;
        }
      }

      if (availableIndex !== -1) {
        // Mark positions as used
        for (let i = 0; i < width; i++) {
          usedPositions.add(availableIndex + i);
        }

        const firstSlot = slots[availableIndex];
        if (firstSlot.type === 'available') {
          slots[availableIndex] = {
            type: 'booking',
            pilot: firstSlot.pilot,
            booking,
            width
          };
          
          // Hide subsequent slots
          for (let i = 1; i < width; i++) {
            const subsequentSlot = slots[availableIndex + i];
            if (subsequentSlot.type === 'available') {
              slots[availableIndex + i] = {
                type: 'hidden',
                pilot: subsequentSlot.pilot
              };
            }
          }
        }
      }
    });

    // Remove available slots that would overlap with bookings
    slots = slots.map((slot, index) => {
      if (slot.type === 'available' && usedPositions.has(index)) {
        return { type: 'empty' };
      }
      return slot;
    });

    return slots;
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
                {getTimeSlotData(time).map((slot, index) => (
                  <div key={index} className={`h-[50px] relative ${
                    slot.type === 'hidden' ? 'hidden' : ''
                  }`}>
                    {slot.type === 'booking' && (
                      <div 
                        className="rounded-lg p-2 text-sm font-medium h-full relative cursor-pointer hover:opacity-90"
                        style={{ 
                          backgroundColor: slot.booking.tags?.color || '#1EAEDB',
                          gridColumn: `span ${slot.width}`,
                          width: `calc(${slot.width * 100}% + ${(slot.width - 1) * 1}rem)`
                        }}
                        onClick={() => setSelectedBooking(slot.booking)}
                      >
                        <div className="absolute top-1 right-1 bg-gray-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">
                          {slot.booking.number_of_people}
                        </div>
                        <div className="flex flex-col text-white text-xs">
                          <span className="font-medium">{slot.booking.name}</span>
                          <span>{slot.booking.pickup_location}</span>
                        </div>
                      </div>
                    )}
                    {slot.type === 'available' && (
                      <div 
                        className="bg-white rounded-lg p-2 text-sm font-medium text-center h-full w-full cursor-pointer hover:bg-gray-50"
                        onClick={() => setSelectedSlot({ time, pilotId: slot.pilot.id })}
                      >
                        Available
                      </div>
                    )}
                    {slot.type === 'unavailable' && (
                      <div className="bg-gray-700 rounded-lg p-2 text-sm font-medium text-center text-white h-full w-full">
                        No {slot.pilot.name}
                      </div>
                    )}
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

      {selectedBooking && (
        <EditBookingModal
          isOpen={!!selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onSubmit={handleUpdateBooking}
          onDelete={handleDeleteBooking}
          booking={selectedBooking}
          maxPeople={4}
        />
      )}
    </div>
  );
};

export default DailyGrid;
