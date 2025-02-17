
import TopBar from "@/components/TopBar";
import DateNavigator from "@/components/DateNavigator";
import DailyGrid from "@/components/DailyGrid";
import { useState } from "react";

const DailyPlan = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  return (
    <div className="min-h-screen bg-background">
      <TopBar pageTitle="Daily Plan" />
      <main className="pt-20 px-4">
        <div className="max-w-7xl mx-auto">
          <DateNavigator date={selectedDate} onDateChange={setSelectedDate} />
          <DailyGrid selectedDate={selectedDate} />
        </div>
      </main>
    </div>
  );
};

export default DailyPlan;
