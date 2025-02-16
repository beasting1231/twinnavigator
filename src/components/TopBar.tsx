
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import SideMenu from "./SideMenu";

const TopBar = () => {
  return (
    <div className="fixed top-0 left-0 right-0 h-16 glass-morphism z-50 px-4 flex items-center justify-between">
      <Sheet>
        <SheetTrigger asChild>
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <Menu className="w-6 h-6" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 bg-background/95 backdrop-blur-xl border-r border-white/10">
          <SideMenu />
        </SheetContent>
      </Sheet>
      <span className="px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-[#9b87f5] to-[#7E69AB] text-white shadow-lg">
        John Doe
      </span>
    </div>
  );
};

export default TopBar;
