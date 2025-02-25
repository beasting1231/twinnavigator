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

interface AssignedPilot {
  pilot_id: string;
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
  booking_date: string;
  phone?: string;
  email?: string;
  tags?: {
    color: string;
    name: string;
  } | null;
  profiles?: {
    username: string | null;
    id: string;
  };
  pilot_assignments?: AssignedPilot[];
}

interface Pilot {
  id: string;
  name: string;
}

type SlotBaseType = {
  pilot?: Pilot;
};

type AvailableSlot = SlotBaseType & { type: 'available'; pilot: Pilot };
type UnavailableSlot = SlotBaseType & { type: 'unavailable'; pilot: Pilot };
type EmptySlot = SlotBaseType & { type: 'empty' };
type BookingSlot = SlotBaseType & { type: 'booking'; pilot: Pilot; booking: Booking; width: number };
type HiddenSlot = SlotBaseType & { type: 'hidden'; pilot: Pilot };

type SlotType = AvailableSlot | UnavailableSlot | EmptySlot | BookingSlot | HiddenSlot;

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
            queryClient.refetchQueries({
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
            queryClient.refetchQueries({
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

      if ( error) {
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
      console.log('Fetching bookings for date:', formattedDate);
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
          booking_date,
          tags (
            color,
            name
          ),
          profiles!bookings_pilot_id_fkey (
            username,
            id
          ),
          pilot_assignments (
            pilot_id,
            profiles!pilot_assignments_pilot_id_fkey (
              username,
              id
            )
          )
        `)
        .eq('booking_date', formattedDate)
        .order('created_at', { ascending: true });

      if (error) throw error;
      console.log('Received bookings:', data);
      return data as Booking[];
    }
  });

  const getAvailablePilotsCount = (time: string): number => {
    return availabilitiesData?.filter(a => a.time_slot === time).length || 0;
  };

  const getTimeSlotData = (time: string): SlotType[] => {
    const timeBookings = bookingsData?.filter(b => b.time_slot === time) || [];
    
    const pilotSlots: (AvailableSlot | UnavailableSlot)[] = availablePilots.map(pilot => {
      const isAvailable = availabilitiesData?.some(
        (a: PilotAvailability) => 
          a.pilot_id === pilot.id && 
          a.time_slot === time
      );

      return isAvailable 
        ? { type: 'available' as const, pilot }
        : { type: 'unavailable' as const, pilot };
    });

    pilotSlots.sort((a, b) => {
      if (a.type === 'available' && b.type === 'unavailable') return -1;
      if (a.type === 'unavailable' && b.type === 'available') return 1;
      return 0;
    });

    let availableSlots: SlotType[] = [...pilotSlots];
    let finalSlots: SlotType[] = [...availableSlots];
    let usedSlots = 0;

    for (const booking of timeBookings) {
      const width = booking.number_of_people;
      if (width <= 0) continue;

      const availableIndex = finalSlots.findIndex(slot => slot.type === 'available');
      if (availableIndex === -1) continue;

      const availableSlot = finalSlots[availableIndex] as AvailableSlot;
      const pilot = availableSlot.pilot;

      const bookingSlot: BookingSlot = {
        type: 'booking',
        pilot,
        booking,
        width
      };
      finalSlots[availableIndex] = bookingSlot;

      for (let i = 1; i < width; i++) {
        if (availableIndex + i < finalSlots.length) {
          const hiddenSlot: HiddenSlot = { type: 'hidden', pilot };
          finalSlots[availableIndex + i] = hiddenSlot;
        }
      }

      usedSlots += width;
    }

    return finalSlots;
  };

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
      console.log('DailyGrid - Starting mutation with data:', data);
      
      const { error } = await supabase
        .from('bookings')
        .update({
          name: data.name,
          pickup_location: data.pickup_location,
          number_of_people: data.number_of_people,
          phone: data.phone || null,
          email: data.email || null,
          tag_id: data.tag_id || null,
          booking_date: data.booking_date,
          time_slot: data.time_slot,
        })
        .eq('id', data.id);

      if (error) {
        console.error('DailyGrid - Supabase update error:', error);
        throw error;
      }

      console.log('DailyGrid - Supabase update successful');
      return data;
    },
    onSuccess: (updatedData) => {
      console.log('DailyGrid - Mutation onSuccess with data:', updatedData);
      queryClient.invalidateQueries({ queryKey: ['bookings', formattedDate] });
      toast({
        title: "Success",
        description: "Booking updated successfully",
      });
      setSelectedBooking(null);
    },
    onError: (error) => {
      console.error('DailyGrid - Mutation onError:', error);
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
    if (!selectedBooking) {
      console.error('DailyGrid - No booking selected for update');
      return;
    }
    
    console.log('DailyGrid - handleUpdateBooking called with:', {
      formData: data,
      selectedBooking,
    });
    
    await updateBooking.mutate({
      ...data,
      id: selectedBooking.id
    });
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

  const gridColumns = `45px ${availablePilots.map(() => 'minmax(180px, 180px)').join(' ')}`;

  return (
    <div className="mt-8 overflow-x-auto pb-4">
      <div className="min-w-[1000px]">
        <div 
          className="grid" 
          style={{ 
            gridTemplateColumns: gridColumns,
            gap: '1rem'
          }}
        >
          <div className="font-semibold mb-2 text-xs">
            Time
          </div>
          
          {availablePilots.map((pilot) => (
            <div 
              key={pilot.id}
              className="text-center font-semibold mb-2 w-[180px]"
            >
              <div>{pilot.name}</div>
            </div>
          ))}

          {TIMES.map((time) => (
            <React.Fragment key={time}>
              <div className="py-2 font-medium text-muted-foreground text-xs whitespace-nowrap">
                {time}
              </div>

              {getTimeSlotData(time).map((slot, index) => {
                if (slot.type === 'hidden' || slot.type === 'empty') return null;
                
                const slotWidth = slot.type === 'booking' 
                  ? `calc(${slot.width * 180}px + ${(slot.width - 1) * 1}rem)`
                  : undefined;
                
                return (
                  <div 
                    key={index} 
                    className="h-[70px] relative"
                    style={{
                      width: slotWidth,
                      gridColumn: slot.type === 'booking' ? `span ${slot.width}` : undefined
                    }}
                  >
                    {slot.type === 'booking' && (
                      <div 
                        className="rounded-lg p-2 text-sm font-medium h-full cursor-pointer hover:opacity-90 flex flex-col justify-between"
                        style={{ 
                          backgroundColor: slot.booking.tags?.color || '#1EAEDB',
                          width: '100%'
                        }}
                        onClick={() => {
                          console.log('Clicked booking:', {
                            booking: slot.booking,
                            hasBookingDate: 'booking_date' in slot.booking,
                            bookingDate: slot.booking.booking_date
                          });
                          setSelectedBooking(slot.booking);
                        }}
                      >
                        <div>
                          <div className="absolute top-1 right-1 bg-gray-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">
                            {slot.booking.number_of_people}
                          </div>
                          <div className="flex flex-col text-white text-xs">
                            <span className="font-medium truncate">{slot.booking.name}</span>
                            <span className="truncate">{slot.booking.pickup_location}</span>
                          </div>
                        </div>
                        {slot.booking.pilot_assignments && slot.booking.pilot_assignments.length > 0 && (
                          <div className="w-[90%] mx-auto mt-1.5">
                            <div className="grid grid-cols-3 gap-1">
                              {slot.booking.pilot_assignments.map((pilot) => (
                                <div 
                                  key={pilot.pilot_id} 
                                  className="bg-black/30 px-2 py-1 rounded text-[10px] font-medium text-white truncate text-center"
                                >
                                  {pilot.profiles.username || 'Unknown Pilot'}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {slot.type === 'available' && (
                      <div 
                        className="bg-white rounded-lg p-2 text-sm font-medium text-center h-[70px] cursor-pointer hover:bg-gray-50 w-[180px] flex items-center justify-center"
                        onClick={() => setSelectedSlot({ time, pilotId: slot.pilot.id })}
                      >
                        Available
                      </div>
                    )}
                    {slot.type === 'unavailable' && (
                      <div className="bg-gray-700 rounded-lg p-2 text-sm font-medium text-center text-white h-[70px] w-[180px] flex items-center justify-center">
                        No {slot.pilot.name}
                      </div>
                    )}
                  </div>
                );
              })}
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
          maxPeople={getAvailablePilotsCount(selectedBooking.time_slot)}
        />
      )}
    </div>
  );
};

export default DailyGrid;
