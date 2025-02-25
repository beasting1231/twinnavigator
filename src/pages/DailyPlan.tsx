
import TopBar from "@/components/TopBar";
import DateNavigator from "@/components/DateNavigator";
import DailyGrid from "@/components/DailyGrid";
import { useState, useEffect } from "react";

const DailyPlan = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    // Find and remove any existing viewport meta tag
    const existingViewport = document.querySelector('meta[name="viewport"]');
    if (existingViewport) {
      existingViewport.remove();
    }

    // Create a new viewport meta tag that allows zooming
    const viewport = document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes';
    document.head.appendChild(viewport);

    // Cleanup function to restore default viewport settings
    return () => {
      viewport.remove();
      const defaultViewport = document.createElement('meta');
      defaultViewport.name = 'viewport';
      defaultViewport.content = 'width=device-width, initial-scale=1.0';
      document.head.appendChild(defaultViewport);
    };
  }, []);

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
