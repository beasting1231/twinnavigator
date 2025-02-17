
import TopBar from "@/components/TopBar";
import DateNavigator from "@/components/DateNavigator";
import WeeklyGrid from "@/components/WeeklyGrid";

const Availability = () => {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="pt-20 px-4">
        <div className="max-w-7xl mx-auto flex flex-col items-center">
          <DateNavigator />
          <WeeklyGrid />
        </div>
      </main>
    </div>
  );
};

export default Availability;
