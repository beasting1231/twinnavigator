import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BookingFormData) => void;
  selectedDate: string;
  timeSlot: string;
  maxPeople: number;
}

export interface BookingFormData {
  id?: string;
  name: string;
  pickup_location: string;
  number_of_people: number;
  phone?: string;
  email?: string;
  tag_id?: string;
  booking_date?: string;
  time_slot?: string;
}

const bookingSchema = z.object({
  name: z.string().min(1, "Name is required"),
  pickup_location: z.string().min(1, "Pickup location is required"),
  number_of_people: z.number().min(1).max(100),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  tag_id: z.string().optional(),
});

const BookingModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  selectedDate, 
  timeSlot,
  maxPeople 
}: BookingModalProps) => {
  const { 
    register, 
    handleSubmit, 
    formState: { errors },
    reset,
    setValue,
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      number_of_people: 1,
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

  const handleFormSubmit = (data: BookingFormData) => {
    onSubmit(data);
    reset();
  };

  React.useEffect(() => {
    if (!isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Booking for {selectedDate} at {timeSlot}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
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
              defaultValue={tags[0]?.id}
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
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Create Booking
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BookingModal;
