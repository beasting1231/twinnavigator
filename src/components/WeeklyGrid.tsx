
import TimeBlock from "./TimeBlock";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIMES = ["8:00 AM", "10:00 AM", "12:00 PM", "2:00 PM", "4:00 PM", "6:00 PM", "8:00 PM"];

const WeeklyGrid = () => {
  return (
    <div className="mt-6">
      <div className="grid grid-cols-7 gap-4">
        {/* Day headers */}
        {DAYS.map((day) => (
          <div key={day} className="text-center font-semibold mb-2">
            {day}
          </div>
        ))}
        
        {/* Time blocks */}
        {DAYS.map((day) => (
          <div key={day} className="space-y-2">
            {TIMES.map((time) => (
              <TimeBlock key={`${day}-${time}`} time={time} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeeklyGrid;
