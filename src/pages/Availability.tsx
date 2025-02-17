
import TopBar from "@/components/TopBar";
import DateNavigator from "@/components/DateNavigator";
import WeeklyGrid from "@/components/WeeklyGrid";

const Availability = () => {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="pt-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-semibold mb-6">Availability</h1>
          <DateNavigator />
          <WeeklyGrid />
        </div>
      </main>
    </div>
  );
};

export default Availability;
