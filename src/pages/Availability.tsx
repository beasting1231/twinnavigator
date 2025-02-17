
import TopBar from "@/components/TopBar";
import DateNavigator from "@/components/DateNavigator";
import WeeklyGrid from "@/components/WeeklyGrid";
import { useState } from "react";

const Availability = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <TopBar pageTitle="Availability" />
      <main className="pt-20 px-4 w-full overflow-x-auto">
        <div className="max-w-7xl mx-auto">
          <DateNavigator date={selectedDate} onDateChange={setSelectedDate} />
          <WeeklyGrid selectedDate={selectedDate} />
        </div>
      </main>
    </div>
  );
};

export default Availability;
