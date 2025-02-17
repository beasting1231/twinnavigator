
import { format, addDays, startOfWeek } from "date-fns";

const TIMES = ["7:30", "8:30", "9:45", "11:00", "12:30", "14:00", "15:30", "16:45"];

interface DailyGridProps {
  selectedDate: Date;
}

const DailyGrid = ({ selectedDate }: DailyGridProps) => {
  // This is temporary mock data - we'll need to integrate with real availability data later
  const mockAvailability: { [key: string]: boolean } = {
    "Monday-7:30": true,
    "Monday-11:00": true,
    "Tuesday-8:30": true,
    "Wednesday-15:30": true,
    "Thursday-12:30": true,
    "Friday-9:45": true,
  };

  // Get the start of the week containing the selected date (Monday)
  const startDate = startOfWeek(selectedDate, { weekStartsOn: 1 });
  
  // Generate array of 7 days starting from Monday
  const DAYS = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(startDate, index);
    return {
      fullName: format(date, "EEEE"),
      displayDate: format(date, "EEE MMM d").toUpperCase(),
      date: date
    };
  });

  return (
    <div className="mt-8 overflow-x-auto pb-4">
      <div className="min-w-[1000px]">
        <div className="grid grid-cols-[120px_1fr] gap-4">
          {/* Time column headers */}
          <div className="font-semibold mb-2">
            Take-off Time
          </div>
          
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-4">
            {DAYS.map((day) => (
              <div 
                key={day.fullName}
                className="text-center font-semibold mb-2"
              >
                <div>{day.displayDate}</div>
              </div>
            ))}
          </div>

          {/* Time slots */}
          {TIMES.map((time) => (
            <React.Fragment key={time}>
              {/* Time label */}
              <div className="py-2 font-medium text-muted-foreground">
                {time}
              </div>

              {/* Available slots for each day */}
              <div className="grid grid-cols-7 gap-4">
                {DAYS.map((day) => {
                  const isAvailable = mockAvailability[`${day.fullName}-${time}`];
                  
                  return (
                    <div key={`${day.fullName}-${time}`} className="min-h-[40px]">
                      {isAvailable && (
                        <div className="bg-green-500/20 text-green-700 rounded-lg p-2 text-sm font-medium text-center">
                          Available
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DailyGrid;
