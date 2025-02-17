
import { useState } from "react";
import TimeBlock from "./TimeBlock";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIMES = ["7:30", "8:30", "9:45", "11:00", "12:30", "14:00", "15:30", "16:45"];

const WeeklyGrid = () => {
  const [availability, setAvailability] = useState<{ [key: string]: boolean }>({});

  const toggleAvailability = (dayTime: string) => {
    setAvailability(prev => ({
      ...prev,
      [dayTime]: !prev[dayTime]
    }));
  };

  const toggleEntireDay = (day: string) => {
    const dayTimeSlots = TIMES.map(time => `${day}-${time}`);
    const allAvailable = dayTimeSlots.every(slot => availability[slot]);
    
    const newAvailability = { ...availability };
    dayTimeSlots.forEach(slot => {
      newAvailability[slot] = !allAvailable;
    });
    
    setAvailability(newAvailability);
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-[1000px]">
        <div className="grid grid-cols-7 gap-4">
          {/* Day headers */}
          {DAYS.map((day) => (
            <div 
              key={day} 
              className="text-center font-semibold mb-2 cursor-pointer hover:text-primary transition-colors"
              onClick={() => toggleEntireDay(day)}
            >
              {day}
            </div>
          ))}
          
          {/* Time blocks */}
          {DAYS.map((day) => (
            <div key={day} className="space-y-2">
              {TIMES.map((time) => {
                const key = `${day}-${time}`;
                return (
                  <TimeBlock 
                    key={key}
                    time={time}
                    isAvailable={availability[key]}
                    onToggle={() => toggleAvailability(key)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeeklyGrid;
