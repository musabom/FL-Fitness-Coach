import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface OptionCardProps {
  title: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  type?: "radio" | "checkbox";
}

export function OptionCard({ title, description, selected, onClick, type = "radio" }: OptionCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer p-5 rounded-2xl border transition-all duration-200 flex items-center gap-4 active:scale-[0.98]",
        selected 
          ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(13,158,117,0.1)]" 
          : "border-card-border bg-card hover:bg-card/80 hover:border-card-border/80"
      )}
    >
      <div className={cn(
        "flex-shrink-0 flex items-center justify-center border transition-colors",
        type === "radio" ? "w-6 h-6 rounded-full" : "w-6 h-6 rounded-md",
        selected ? "border-primary bg-primary" : "border-muted-foreground/30 bg-transparent"
      )}>
        {selected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
      </div>
      <div className="flex-1">
        <h4 className="text-base font-medium text-foreground">{title}</h4>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
    </div>
  );
}
