
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, addWeeks, subWeeks } from "date-fns";

interface DateNavigatorProps {
  date: Date;
  onDateChange: (date: Date) => void;
}

const DateNavigator = ({ date, onDateChange }: DateNavigatorProps) => {
  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = direction === 'next' 
      ? addWeeks(date, 1)
      : subWeeks(date, 1);
    onDateChange(newDate);
  };

  return (
    <div className="flex items-center justify-center gap-4 bg-card p-4 rounded-lg">
      <Button
        variant="outline"
        size="icon"
        onClick={() => navigateWeek('prev')}
        className="h-8 w-8"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="min-w-[240px] justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(date, "EEEE, MMMM do, yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(newDate) => newDate && onDateChange(newDate)}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="icon"
        onClick={() => navigateWeek('next')}
        className="h-8 w-8"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default DateNavigator;
