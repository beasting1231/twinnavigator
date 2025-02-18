
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BookingFormData } from './BookingModal';

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
});

const EditBookingModal = ({ 
  isOpen, 
  onClose, 
  onSubmit,
  onDelete,
  booking,
  maxPeople 
}: EditBookingModalProps) => {
  console.log('EditBookingModal - Rendering with booking:', booking);

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
    }
  });

  // Watch form values for debugging
  const formValues = watch();
  console.log('EditBookingModal - Current form values:', formValues);

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

  const handleFormSubmit = async (data: BookingFormData) => {
    console.log('EditBookingModal - handleFormSubmit called with data:', data);
    try {
      await onSubmit({
        ...data,
        id: booking.id,
      });
      console.log('EditBookingModal - onSubmit completed successfully');
      onClose();
    } catch (error) {
      console.error('EditBookingModal - Error submitting form:', error);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      console.log('EditBookingModal - Resetting form with booking:', booking);
      reset({
        id: booking.id,
        name: booking.name,
        pickup_location: booking.pickup_location,
        number_of_people: booking.number_of_people,
        phone: booking.phone || '',
        email: booking.email || '',
        tag_id: booking.tag_id || '',
      });
    }
  }, [isOpen, booking, reset]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="pr-8">Edit Booking</DialogTitle>
          <DialogDescription>
            Make changes to your booking here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <form 
          onSubmit={(e) => {
            console.log('EditBookingModal - Form submit event triggered');
            handleSubmit(handleFormSubmit)(e);
          }} 
          className="space-y-4"
        >
          {/* Hidden input for id */}
          <input type="hidden" {...register('id')} />
          
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
              onValueChange={(value) => {
                console.log('EditBookingModal - Tag selected:', value);
                setValue('tag_id', value);
              }}
              defaultValue={booking.tag_id}
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
                console.log('EditBookingModal - Delete button clicked');
                onDelete();
                onClose();
              }}
            >
              Delete Booking
            </Button>
            <Button 
              type="submit"
              onClick={() => console.log('EditBookingModal - Submit button clicked')}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditBookingModal;
