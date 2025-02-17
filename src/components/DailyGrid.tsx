
import React from 'react';
import { format } from "date-fns";

const TIMES = ["7:30", "8:30", "9:45", "11:00", "12:30", "14:00", "15:30", "16:45"];

interface DailyGridProps {
  selectedDate: Date;
}

const DailyGrid = ({ selectedDate }: DailyGridProps) => {
  // This is temporary mock data - we'll need to integrate with real availability data later
  const mockPilotAvailability = {
    "John Smith": {
      "7:30": true,
      "11:00": true
    },
    "Sarah Johnson": {
      "8:30": true,
      "15:30": true
    },
    "Mike Wilson": {
      "12:30": true
    }
  };

  // Get all pilots that have at least one available time slot
  const availablePilots = Object.keys(mockPilotAvailability);

  const selectedDay = format(selectedDate, "EEEE MMM d").toUpperCase();

  return (
    <div className="mt-8 overflow-x-auto pb-4">
      <div className="min-w-[1000px]">
        <div className="grid grid-cols-[120px_1fr] gap-4">
          {/* Time column header */}
          <div className="font-semibold mb-2">
            Time
          </div>
          
          {/* Pilots header */}
          <div className="grid grid-cols-3 gap-4">
            {availablePilots.map((pilot) => (
              <div 
                key={pilot}
                className="text-center font-semibold mb-2"
              >
                <div>{pilot}</div>
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

              {/* Available slots for each pilot */}
              <div className="grid grid-cols-3 gap-4">
                {availablePilots.map((pilot) => {
                  const isAvailable = mockPilotAvailability[pilot][time];
                  
                  return (
                    <div key={`${pilot}-${time}`} className="min-h-[40px]">
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

        <div className="mt-4 text-center text-muted-foreground">
          Selected Day: {selectedDay}
        </div>
      </div>
    </div>
  );
};

export default DailyGrid;
