import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, Loader2 } from "lucide-react";
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
import { RealtimeChannel } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BookingFormData } from './BookingModal';
import { useToast } from "@/components/ui/use-toast";

const TIMES = ["7:30", "8:30", "9:45", "11:00", "12:30", "14:00", "15:30", "16:45"];

interface EditBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  onSubmit: (data: BookingFormData) => Promise<void>;
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
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  pickup_location: z.string().min(1, "Pickup location is required"),
  number_of_people: z.number().min(1, "Must have at least 1 person").max(100, "Maximum 100 people"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  tag_id: z.string().optional(),
  booking_date: z.string(),
  time_slot: z.string().min(1, "Time slot is required"),
});

const EditBookingModal = ({ 
  isOpen, 
  onClose, 
  onSubmit,
  onDelete,
  booking,
  maxPeople 
}: EditBookingModalProps) => {
  console.log('EditBookingModal render:', { 
    booking, 
    isOpen,
    hasBookingDate: booking?.booking_date,
    bookingDateValue: booking?.booking_date
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = React.useState(booking.time_slot);
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const [isSavingPayments, setIsSavingPayments] = React.useState(false);
  const [paymentAmounts, setPaymentAmounts] = React.useState<Record<string, number>>({});
  
  const [date, setDate] = React.useState<Date | null>(null);

  const formattedDate = date ? format(date, 'yyyy-MM-dd') : booking?.booking_date;
  console.log('EditBookingModal formattedDate:', { date, formattedDate, originalDate: booking?.booking_date });

  const { 
    register, 
    handleSubmit, 
    formState: { errors, isDirty },
    reset,
    setValue,
    watch,
    trigger,
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

  console.log('EditBookingModal form initialized:', { 
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

  React.useEffect(() => {
    console.log('EditBookingModal useEffect [isOpen, booking]:', { 
      isOpen, 
      booking,
      hasBookingDate: booking?.booking_date,
      bookingDateValue: booking?.booking_date
    });
    
    if (isOpen) {
      const resetValues = {
        id: booking.id,
        name: booking.name,
        pickup_location: booking.pickup_location,
        number_of_people: booking.number_of_people,
        phone: booking.phone || '',
        email: booking.email || '',
        tag_id: booking.tag_id || '',
        booking_date: booking.booking_date,
        time_slot: booking.time_slot,
      };
      console.log('EditBookingModal resetting form with:', resetValues);
      
      reset(resetValues);
      setSelectedTimeSlot(booking.time_slot);
      setDate(null); // Reset date state to null to use original booking date
    }
  }, [booking, isOpen, reset]);

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
    queryKey: ['available-pilots-count', booking.booking_date],
    enabled: true,
    queryFn: async () => {
      console.log('Fetching pilots and bookings for date:', formattedDate);
      
      // Get available pilots
      const { data: availabilities, error: availError } = await supabase
        .from('pilot_availability')
        .select('time_slot, pilot_id')
        .eq('day', date ? formattedDate : booking.booking_date);

      if (availError) {
        console.error('Error fetching availabilities:', availError);
        throw availError;
      }

      // Get existing bookings
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('time_slot, number_of_people')
        .eq('booking_date', date ? formattedDate : booking.booking_date);

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        throw bookingsError;
      }

      console.log('Received data:', { availabilities, bookings });

      // Calculate available pilots per time slot
      const pilotCounts: Record<string, number> = {};
      TIMES.forEach(time => {
        const totalPilots = availabilities?.filter(a => a.time_slot === time).length || 0;
        const bookedPeople = bookings
          ?.filter(b => b.time_slot === time)
          .reduce((sum, b) => sum + b.number_of_people, 0) || 0;
        
        // Available pilots is total pilots minus booked people
        pilotCounts[time] = Math.max(0, totalPilots - bookedPeople);
      });

      console.log('Calculated available pilot counts:', pilotCounts);
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
        .from('pilot_assignments')
        .select(`
          pilot_id,
          payment_amount,
          receipt_url,
          profiles:pilot_id (
            id,
            username,
            gender
          )
        `)
        .eq('booking_id', booking.id)
        .in('pilot_id', assignedPilotIds);

      if (error) throw error;
      
      return data.map(d => ({
        ...d.profiles,
        payment_amount: d.payment_amount,
        receipt_url: d.receipt_url
      })) || [];
    }
  });

  useEffect(() => {
    let channel: RealtimeChannel;

    const setupRealtimeSubscription = () => {
      channel = supabase
        .channel('edit-booking-modal-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pilot_availability'
          },
          () => {
            queryClient.refetchQueries({
              queryKey: ['available-pilots', date ? formattedDate : booking.booking_date, selectedTimeSlot]
            });
            queryClient.refetchQueries({
              queryKey: ['available-pilots-count', booking.booking_date]
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
              queryKey: ['available-pilots-count', booking.booking_date]
            });
          }
        )
        .subscribe();
    };

    if (isOpen) {
      setupRealtimeSubscription();
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [isOpen, formattedDate, queryClient, date, booking.booking_date, selectedTimeSlot]);

  const { data: availablePilots = [] } = useQuery({
    queryKey: ['available-pilots', date ? formattedDate : booking.booking_date, selectedTimeSlot],
    enabled: !!selectedTimeSlot,
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
        .eq('day', date ? formattedDate : booking.booking_date)
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

  const handleTimeSlotChange = async (value: string) => {
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
    setValue('time_slot', value, { shouldValidate: true, shouldDirty: true });
  };

  const handleDateChange = (newDate: Date | undefined) => {
    if (newDate) {
      const formattedNewDate = format(newDate, 'yyyy-MM-dd');
      if (formattedNewDate !== booking.booking_date) {
        setDate(newDate);
        setValue('booking_date', formattedNewDate, { 
          shouldValidate: true, 
          shouldDirty: true 
        });
      }
      setIsCalendarOpen(false);
    }
  };

  const handleFormSubmit = async (data: BookingFormData) => {
    try {
      setIsSubmitting(true);
      console.log('EditBookingModal - Submitting form with data:', data);

      // Check pilot availability before proceeding
      const availableCount = availablePilotsForTime[selectedTimeSlot] || 0;
      if (availableCount < booking.number_of_people) {
        toast({
          variant: "destructive",
          title: "Insufficient Pilots",
          description: `This time slot only has ${availableCount} pilot${availableCount === 1 ? '' : 's'} available. You need ${booking.number_of_people}.`,
        });
        return;
      }

      const isValid = await trigger();
      if (!isValid) {
        console.log('EditBookingModal - Form validation failed:', errors);
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Please check all required fields",
        });
        return;
      }

      console.log('EditBookingModal - Preparing submission data:', {
        formData: data,
        date,
        formattedDate,
        originalDate: booking.booking_date,
        selectedTimeSlot,
        isDirty,
        errors
      });

      // Always use the original booking date unless explicitly changed
      const submissionData = {
        ...data,
        booking_date: date ? formattedDate : booking.booking_date,
        time_slot: selectedTimeSlot,
      };

      console.log('EditBookingModal - Final submission data:', submissionData);
      await onSubmit(submissionData);
      
      // Immediately refetch queries for both old and new dates
      if (date && formattedDate !== booking.booking_date) {
        await queryClient.refetchQueries({ 
          queryKey: ['daily-plan', booking.booking_date],
          type: 'active'
        });
      }
      await queryClient.refetchQueries({ 
        queryKey: ['daily-plan', submissionData.booking_date],
        type: 'active'
      });
      
      // Wait for queries to complete before navigating
      await queryClient.refetchQueries({
        queryKey: ['bookings', submissionData.booking_date],
        type: 'active'
      });

      reset(submissionData);
      onClose();
      
      // Navigate to the new date if it changed
      if (date && formattedDate !== booking.booking_date) {
        // Invalidate queries for both old and new dates
        await Promise.all([
          queryClient.invalidateQueries({ 
            queryKey: ['daily-plan', booking.booking_date],
            type: 'active'
          }),
          queryClient.invalidateQueries({ 
            queryKey: ['daily-plan', submissionData.booking_date],
            type: 'active'
          }),
          queryClient.invalidateQueries({
            queryKey: ['bookings', submissionData.booking_date],
            type: 'active'
          })
        ]);
        
        // Close modal and navigate to new date
        onClose();
        window.location.href = `/daily-plan?date=${submissionData.booking_date}`;
        return;
      }
      
      // For same date changes, just invalidate queries and close
      await Promise.all([
        queryClient.invalidateQueries({ 
          queryKey: ['daily-plan', submissionData.booking_date],
          type: 'active'
        }),
        queryClient.invalidateQueries({
          queryKey: ['bookings', submissionData.booking_date],
          type: 'active'
        })
      ]);
      onClose();
      
      toast({
        title: "Success", 
        description: "Booking updated successfully",
      });
    } catch (error) {
      console.error('EditBookingModal - Form submission error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update booking. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePilotAssignment = async (pilotId: string, paymentAmount?: number, receiptFile?: File) => {
    try {
      let receiptUrl = '';
      
      if (receiptFile) {
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('receipts')
          .upload(`receipts/${booking.id}/${pilotId}/${receiptFile.name}`, receiptFile);
        
        if (uploadError) throw uploadError;
        receiptUrl = uploadData.path;
      }

      const { error } = await supabase
        .from('pilot_assignments')
        .insert({
          booking_id: booking.id,
          pilot_id: pilotId,
          payment_amount: paymentAmount,
          receipt_url: receiptUrl
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && !isSubmitting) {
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogTitle>Edit Booking</DialogTitle>
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Booking Details</TabsTrigger>
            <TabsTrigger value="pilots">Assign Pilots</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details">
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
              <input type="hidden" {...register('id')} />
              
              <div className="space-y-2">
                <Label>Date *</Label>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, 'PPP') : (booking?.booking_date ? format(parseISO(booking.booking_date), 'PPP') : 'Pick a date')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={handleDateChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {errors.booking_date && (
                  <p className="text-sm text-destructive">{errors.booking_date.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Time Slot *</Label>
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
                {errors.time_slot && (
                  <p className="text-sm text-destructive">{errors.time_slot.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  className="mt-1"
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pickup_location">Pickup Location *</Label>
                <Input
                  id="pickup_location"
                  {...register('pickup_location')}
                  className="mt-1"
                />
                {errors.pickup_location && (
                  <p className="text-sm text-destructive">{errors.pickup_location.message}</p>
                )}
              </div>

              <div className="space-y-2">
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
                  <p className="text-sm text-destructive">{errors.number_of_people.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  {...register('phone')}
                  className="mt-1"
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  className="mt-1"
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tag">Tag</Label>
                <Select 
                  onValueChange={(value) => setValue('tag_id', value, { shouldValidate: true })}
                  value={watch('tag_id') || undefined}
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
                    if (window.confirm('Are you sure you want to delete this booking?')) {
                      onDelete();
                      onClose();
                    }
                  }}
                  disabled={isSubmitting}
                >
                  Delete Booking
                </Button>
                <Button 
                  type="submit"
                  disabled={isSubmitting || !isDirty}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
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
                  <div key={pilot.id} className="flex flex-col gap-2 p-2 border rounded">
                    <div className="flex items-center justify-between">
                      <span>{pilot.username}</span>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handlePilotUnassignment(pilot.id)}
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Input
                        type="number"
                        placeholder="Payment amount"
                        value={paymentAmounts[pilot.id] ?? pilot.payment_amount ?? ''}
                        onChange={(e) => {
                          const value = e.target.value ? parseFloat(e.target.value) : undefined;
                          setPaymentAmounts(prev => ({
                            ...prev,
                            [pilot.id]: value as number
                          }));
                        }}
                      />
                      <Button
                        variant="outline"
                        className="bg-blue-500 text-white hover:bg-blue-600"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              supabase
                                .storage
                                .from('receipts')
                                .upload(`receipts/${booking.id}/${pilot.id}/${file.name}`, file)
                                .then(({ data }) => {
                                  if (data) {
                                    supabase
                                      .from('pilot_assignments')
                                      .update({ receipt_url: data.path })
                                      .eq('booking_id', booking.id)
                                      .eq('pilot_id', pilot.id);
                                  }
                                });
                            }
                          };
                          input.click();
                        }}
                      >
                        Upload Receipt
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={async () => {
                    try {
                      setIsSavingPayments(true);
                      
                      const updates = assignedPilots
                        .filter(pilot => paymentAmounts[pilot.id] !== undefined)
                        .map(pilot => 
                          supabase
                            .from('pilot_assignments')
                            .update({ payment_amount: paymentAmounts[pilot.id] })
                            .eq('booking_id', booking.id)
                            .eq('pilot_id', pilot.id)
                        );

                      if (updates.length === 0) {
                        toast({
                          title: "No Changes",
                          description: "No payment amounts to update",
                        });
                        return;
                      }

                      const results = await Promise.all(updates);
                      const errors = results.filter(r => r.error).map(r => r.error);
                      if (errors.length > 0) {
                        throw new Error(errors[0]?.message || 'Failed to save payments');
                      }

                      // Invalidate queries to refresh data
                      await queryClient.invalidateQueries({ 
                        queryKey: ['assigned-pilots', assignedPilotIds]
                      });
                      
                      toast({
                        title: "Success",
                        description: "Payments saved successfully",
                      });

                      // Reset payment amounts state to reflect saved state
                      setPaymentAmounts({});
                    } catch (error) {
                      console.error('Error saving payments:', error);
                      toast({
                        variant: "destructive",
                        title: "Error",
                        description: error instanceof Error ? error.message : "Failed to save payments",
                      });
                    } finally {
                      setIsSavingPayments(false);
                    }
                  }}
                  disabled={isSavingPayments}
                >
                  {isSavingPayments ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save'
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                <Select
                  onValueChange={(pilotId) => handlePilotAssignment(pilotId)}
                  disabled={assignedPilots.length >= booking.number_of_people}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a pilot to assign" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePilots
                      .filter(pilot => !assignedPilots.some(ap => ap.id === pilot.id))
                      .map((pilot) => (
                        <SelectItem key={pilot.id} value={pilot.id}>
                          {pilot.username}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default EditBookingModal;
