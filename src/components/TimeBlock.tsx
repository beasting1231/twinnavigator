
import { cn } from "@/lib/utils";
import { useState } from "react";

interface TimeBlockProps {
  time: string;
  isAvailable?: boolean;
  onToggle?: () => void;
}

const TimeBlock = ({ time, isAvailable = false, onToggle }: TimeBlockProps) => {
  return (
    <div
      onClick={onToggle}
      className={cn(
        "p-4 rounded-lg text-sm font-medium transition-colors cursor-pointer",
        isAvailable 
          ? "bg-[#F2FCE2] hover:bg-[#F2FCE2]/80 text-green-700" 
          : "bg-[#ea384c]/10 hover:bg-[#ea384c]/20 text-red-500"
      )}
    >
      {time}
    </div>
  );
};

export default TimeBlock;
