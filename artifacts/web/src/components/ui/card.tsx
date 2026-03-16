import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-2xl border border-card-border bg-card text-card-foreground shadow-xl shadow-black/20", className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

export { Card };
