import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BookingFormData } from './BookingModal';
import { useToast } from "@/components/ui/use-toast";

const TIMES = ["7:30", "8:30", "9:45", "11:00", "12:30", "14:00", "15:30", "16:45"];

interface EditBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  onSubmit: (data: BookingFormData) => void;
  booking: {
    id: string;
    name: string;
    pickup_location: string;
    number_of_people: number;
    phone?: string;
    email?: string;
    tag_id?: string;
    booking_date: string;
    time_slot: string;
  };
  maxPeople: number;
}

const bookingSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  pickup_location: z.string().min(1, "Pickup location is required"),
  number_of_people: z.number().min(1).max(100),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  tag_id: z.string().optional(),
  booking_date: z.string(),
  time_slot: z.string(),
});

const EditBookingModal = ({ 
  isOpen, 
  onClose, 
  onSubmit,
  onDelete,
  booking,
  maxPeople 
}: EditBookingModalProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedTimeSlot, setSelectedTimeSlot] = React.useState(booking.time_slot);
  
  const [date, setDate] = React.useState<Date | undefined>(() => {
    try {
      return booking.booking_date ? parseISO(booking.booking_date) : undefined;
    } catch (error) {
      console.error('Error parsing date:', error);
      return undefined;
    }
  });

  const formattedDate = date ? format(date, 'yyyy-MM-dd') : booking.booking_date;

  const { 
    register, 
    handleSubmit, 
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      id: booking.id,
      name: booking.name,
      pickup_location: booking.pickup_location,
      number_of_people: booking.number_of_people,
      phone: booking.phone || '',
      email: booking.email || '',
      tag_id: booking.tag_id || '',
      booking_date: booking.booking_date,
      time_slot: booking.time_slot,
    }
  });

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('*');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: availablePilotsForTime = {}, isLoading: isPilotsLoading } = useQuery({
    queryKey: ['available-pilots-count', formattedDate],
    enabled: !!formattedDate,
    queryFn: async () => {
      console.log('Fetching pilots for date:', formattedDate);
      
      const { data: availabilities, error } = await supabase
        .from('pilot_availability')
        .select('time_slot, pilot_id')
        .eq('day', formattedDate);

      if (error) {
        console.error('Error fetching availabilities:', error);
        throw error;
      }

      console.log('Received availabilities:', availabilities);

      const pilotCounts: Record<string, number> = {};
      TIMES.forEach(time => {
        pilotCounts[time] = availabilities?.filter(a => a.time_slot === time).length || 0;
      });

      console.log('Calculated pilot counts:', pilotCounts);
      return pilotCounts;
    }
  });

  const { data: assignedPilotIds = [] } = useQuery({
    queryKey: ['assigned-pilot-ids', booking.id],
    enabled: !!booking.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pilot_assignments')
        .select('pilot_id')
        .eq('booking_id', booking.id);

      if (error) throw error;
      return (data || []).map(d => d.pilot_id);
    }
  });

  const { data: assignedPilots = [] } = useQuery({
    queryKey: ['assigned-pilots', assignedPilotIds],
    enabled: assignedPilotIds.length > 0,
    queryFn: async () => {
      if (assignedPilotIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, gender')
        .in('id', assignedPilotIds);

      if (error) throw error;
      return data || [];
    }
  });

  const { data: availablePilots = [] } = useQuery({
    queryKey: ['available-pilots', formattedDate, selectedTimeSlot],
    enabled: !!formattedDate && !!selectedTimeSlot,
    queryFn: async () => {
      console.log('Fetching available pilots for:', { formattedDate, selectedTimeSlot });
      
      const { data: availabilities, error: availabilitiesError } = await supabase
        .from('pilot_availability')
        .select(`
          pilot_id,
          profiles:pilot_id (
            id,
            username,
            gender
          )
        `)
        .eq('day', formattedDate)
        .eq('time_slot', selectedTimeSlot);

      if (availabilitiesError) throw availabilitiesError;

      console.log('Received available pilots:', availabilities);
      
      return availabilities
        .filter(a => a.profiles)
        .map(a => a.profiles)
        .filter((pilot, index, self) => 
          index === self.findIndex(p => p.id === pilot.id)
        );
    }
  });

  const handleTimeSlotChange = (value: string) => {
    const availableCount = availablePilotsForTime[value] || 0;
    console.log('Handling time slot change:', { value, availableCount, required: booking.number_of_people });
    
    if (availableCount < booking.number_of_people) {
      toast({
        variant: "destructive",
        title: "Invalid Time Slot",
        description: `This time slot only has ${availableCount} pilot${availableCount === 1 ? '' : 's'} available. You need ${booking.number_of_people}.`,
      });
      return;
    }

    setSelectedTimeSlot(value);
    setValue('time_slot', value);
  };

  const handleFormSubmit = async (data: BookingFormData) => {
    console.log('EditBookingModal - handleFormSubmit called with data:', data);
    try {
      if (!formattedDate) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Please select a date",
        });
        return;
      }

      const updatedData = {
        ...data,
        booking_date: formattedDate,
      };
      
      console.log('EditBookingModal - Submitting with updatedData:', updatedData);
      await onSubmit(updatedData);
      onClose();
    } catch (error) {
      console.error('EditBookingModal - Error submitting form:', error);
    }
  };

  const handlePilotAssignment = async (pilotId: string) => {
    try {
      const { error } = await supabase
        .from('pilot_assignments')
        .insert({
          booking_id: booking.id,
          pilot_id: pilotId
        });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['assigned-pilot-ids', booking.id] });
      queryClient.invalidateQueries({ queryKey: ['assigned-pilots'] });
      
      toast({
        title: "Success",
        description: "Pilot assigned successfully",
      });
    } catch (error) {
      console.error('Error assigning pilot:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to assign pilot",
      });
    }
  };

  const handlePilotUnassignment = async (pilotId: string) => {
    try {
      const { error } = await supabase
        .from('pilot_assignments')
        .delete()
        .eq('booking_id', booking.id)
        .eq('pilot_id', pilotId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['assigned-pilot-ids', booking.id] });
      queryClient.invalidateQueries({ queryKey: ['assigned-pilots'] });
      
      toast({
        title: "Success",
        description: "Pilot unassigned successfully",
      });
    } catch (error) {
      console.error('Error unassigning pilot:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to unassign pilot",
      });
    }
  };

  React.useEffect(() => {
    if (isOpen && booking.booking_date) {
      console.log('EditBookingModal - Resetting form with booking:', booking);
      try {
        const parsedDate = parseISO(booking.booking_date);
        setDate(parsedDate);
        setSelectedTimeSlot(booking.time_slot);
        setValue('booking_date', booking.booking_date);
        setValue('time_slot', booking.time_slot);

        reset({
          id: booking.id,
          name: booking.name,
          pickup_location: booking.pickup_location,
          number_of_people: booking.number_of_people,
          phone: booking.phone || '',
          email: booking.email || '',
          tag_id: booking.tag_id || '',
          booking_date: booking.booking_date,
          time_slot: booking.time_slot,
        });
      } catch (error) {
        console.error('Error parsing date in useEffect:', error);
      }
    }
  }, [isOpen, booking, reset, setValue]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogTitle>Edit Booking</DialogTitle>
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Booking Details</TabsTrigger>
            <TabsTrigger value="pilots">Assign Pilots</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(handleFormSubmit)(e);
              }} 
              className="space-y-4"
            >
              <input type="hidden" {...register('id')} />
              
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      type="button"
                    >
                      {date ? format(date, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(newDate) => {
                        if (newDate) {
                          setDate(newDate);
                          setValue('booking_date', format(newDate, 'yyyy-MM-dd'));
                          setSelectedTimeSlot('');
                          setValue('time_slot', '');
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Time Slot</Label>
                <Select 
                  onValueChange={handleTimeSlotChange}
                  value={watch('time_slot')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a time" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMES.map((time) => {
                      const availableCount = availablePilotsForTime[time] || 0;
                      const isDisabled = availableCount < booking.number_of_people;
                      
                      return (
                        <SelectItem 
                          key={time} 
                          value={time}
                          disabled={isDisabled}
                          className={isDisabled ? 'opacity-50' : ''}
                        >
                          {time} ({availableCount} {availableCount === 1 ? 'pilot' : 'pilots'})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  className="mt-1"
                />
                {errors.name && (
                  <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="pickup_location">Pickup Location *</Label>
                <Input
                  id="pickup_location"
                  {...register('pickup_location')}
                  className="mt-1"
                />
                {errors.pickup_location && (
                  <p className="text-sm text-red-500 mt-1">{errors.pickup_location.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="number_of_people">Number of People *</Label>
                <Input
                  id="number_of_people"
                  type="number"
                  min={1}
                  max={maxPeople}
                  {...register('number_of_people', { valueAsNumber: true })}
                  className="mt-1"
                />
                {errors.number_of_people && (
                  <p className="text-sm text-red-500 mt-1">{errors.number_of_people.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="phone">Phone (Optional)</Label>
                <Input
                  id="phone"
                  {...register('phone')}
                  className="mt-1"
                />
                {errors.phone && (
                  <p className="text-sm text-red-500 mt-1">{errors.phone.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  className="mt-1"
                />
                {errors.email && (
                  <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="tag">Tag</Label>
                <Select 
                  onValueChange={(value) => setValue('tag_id', value)}
                  defaultValue={booking.tag_id || undefined}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="destructive"
                  onClick={() => {
                    onDelete();
                    onClose();
                  }}
                >
                  Delete Booking
                </Button>
                <Button type="submit">
                  Save Changes
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="pilots" className="space-y-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Assigned Pilots ({assignedPilots.length}/{booking.number_of_people})</h3>
              </div>
              
              <div className="space-y-2">
                {assignedPilots.map((pilot) => (
                  <div key={pilot.id} className="flex items-center justify-between p-2 border rounded">
                    <span>{pilot.username}</span>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handlePilotUnassignment(pilot.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium">Available Pilots</h3>
                {availablePilots
                  .filter(pilot => !assignedPilots.some(ap => ap.id === pilot.id))
                  .map((pilot) => (
                    <div key={pilot.id} className="flex items-center justify-between p-2 border rounded">
                      <span>{pilot.username}</span>
                      <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={() => handlePilotAssignment(pilot.id)}
                        disabled={assignedPilots.length >= booking.number_of_people}
                      >
                        Assign
                      </Button>
                    </div>
                  ))
                }
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default EditBookingModal;
