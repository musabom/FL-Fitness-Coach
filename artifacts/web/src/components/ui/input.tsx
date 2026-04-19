import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

// FLInput spec: 56px height, 16px radius, #0F1F3D bg, teal border + glow on focus.
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        // Layout
        "flex h-14 w-full px-4 py-2 text-[15px]",
        // Shape
        "rounded-xl border",
        // Colors
        "bg-input text-foreground placeholder:text-muted-foreground",
        "border-border",
        // Focus — teal border + glow (matches FLInput exactly)
        "focus-visible:outline-none",
        "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15",
        // Files & misc
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "transition-all duration-200",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
