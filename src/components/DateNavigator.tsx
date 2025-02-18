
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, addDays, subDays, addWeeks, subWeeks } from "date-fns";
import { useLocation } from "react-router-dom";

interface DateNavigatorProps {
  date: Date;
  onDateChange: (date: Date) => void;
}

const DateNavigator = ({ date, onDateChange }: DateNavigatorProps) => {
  const location = useLocation();
  const isDailyPlan = location.pathname.includes('daily-plan');

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = isDailyPlan
      ? (direction === 'next' ? addDays(date, 1) : subDays(date, 1))
      : (direction === 'next' ? addWeeks(date, 1) : subWeeks(date, 1));
    onDateChange(newDate);
  };

  return (
    <div className="flex items-center justify-center gap-4 bg-card p-4 rounded-lg">
      <Button
        variant="outline"
        size="icon"
        onClick={() => navigateDate('prev')}
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
        onClick={() => navigateDate('next')}
        className="h-8 w-8"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default DateNavigator;
