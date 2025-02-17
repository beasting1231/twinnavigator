
import TopBar from "@/components/TopBar";
import DateNavigator from "@/components/DateNavigator";
import WeeklyGrid from "@/components/WeeklyGrid";

const Availability = () => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <TopBar />
      <main className="pt-20 px-4 w-full overflow-x-auto">
        <div className="max-w-7xl mx-auto">
          <DateNavigator />
          <WeeklyGrid />
        </div>
      </main>
    </div>
  );
};

export default Availability;
