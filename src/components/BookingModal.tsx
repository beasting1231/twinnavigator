
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
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Clipboard, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from "@/lib/utils";

const TIME_SLOTS = [
  "7:30", "8:30", "9:45", "11:00", "12:30", "14:00", "15:30", "16:45"
];

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
  booking_date: string;
  time_slot: string;
}

const bookingSchema = z.object({
  name: z.string().min(1, "Name is required"),
  pickup_location: z.string().min(1, "Pickup location is required"),
  number_of_people: z.number().min(1).max(100),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  tag_id: z.string().optional(),
  booking_date: z.string().min(1, "Date is required"),
  time_slot: z.string().min(1, "Time slot is required"),
});

const BookingModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  selectedDate, 
  timeSlot,
  maxPeople 
}: BookingModalProps) => {
  const [date, setDate] = React.useState<Date | undefined>(
    selectedDate ? new Date(selectedDate) : undefined
  );
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  
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
      number_of_people: 1,
      booking_date: selectedDate,
      time_slot: timeSlot,
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
      setDate(undefined);
      setIsCalendarOpen(false);
    }
  }, [isOpen, reset]);

  const handleDateSelect = (newDate: Date | undefined) => {
    if (newDate) {
      setDate(newDate);
      setValue('booking_date', format(newDate, 'yyyy-MM-dd'));
      setIsCalendarOpen(false); // Close the calendar after selection
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center">
            <span>New Booking</span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                console.log('Insert from clipboard clicked');
              }}
              className="flex items-center gap-2"
            >
              <Clipboard className="w-4 h-4" />
              Insert from Clipboard
            </Button>
          </DialogTitle>
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
            <Label>Date *</Label>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal mt-1",
                    !date && "text-muted-foreground"
                  )}
                  onClick={() => setIsCalendarOpen(true)}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleDateSelect}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {errors.booking_date && (
              <p className="text-sm text-red-500 mt-1">{errors.booking_date.message}</p>
            )}
          </div>

          <div>
            <Label>Time *</Label>
            <Select 
              onValueChange={(value) => setValue('time_slot', value)}
              defaultValue={timeSlot}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a time" />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {slot}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.time_slot && (
              <p className="text-sm text-red-500 mt-1">{errors.time_slot.message}</p>
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
