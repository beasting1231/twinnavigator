
import { cn } from "@/lib/utils";

interface TimeBlockProps {
  time: string;
  isAvailable?: boolean;
}

const TimeBlock = ({ time, isAvailable = true }: TimeBlockProps) => {
  return (
    <div
      className={cn(
        "p-4 rounded-lg text-sm font-medium transition-colors",
        isAvailable ? "bg-secondary hover:bg-secondary/80 cursor-pointer" : "bg-muted/50"
      )}
    >
      {time}
    </div>
  );
};

export default TimeBlock;
