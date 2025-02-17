
import { CalendarCheck, UserCircle, LogOut, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const SideMenu = () => {
  const { signOut } = useAuth();

  const menuItems = [
    { icon: CalendarCheck, label: "Daily Plan", path: "/daily-plan" },
    { icon: Clock, label: "Availability", path: "/availability" },
    { icon: UserCircle, label: "My Account", path: "/account" },
  ];

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="space-y-1 mt-12">
        {menuItems.map((item) => (
          <Link
            key={item.label}
            to={item.path}
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors"
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default SideMenu;
