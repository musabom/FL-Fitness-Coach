import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "outline" | "ghost" | "secondary" | "destructive";
type ButtonSize = "default" | "sm" | "lg" | "icon";

const variantStyles: Record<ButtonVariant, string> = {
  // primary — teal fill + teal glow (FL signature)
  default:
    "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_rgba(45,212,191,0.25)] hover:shadow-[0_0_28px_rgba(45,212,191,0.35)]",
  // outline — dark card fill, navy border
  outline:
    "border border-border bg-card hover:bg-muted text-foreground",
  ghost:
    "hover:bg-muted/60 text-foreground",
  secondary:
    "bg-muted text-foreground hover:bg-muted/80",
  destructive:
    "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[0_0_20px_rgba(239,68,68,0.2)]",
};

// Heights: sm=40 md=48 lg=56 — match FLButton spec exactly
const sizeStyles: Record<ButtonSize, string> = {
  default: "h-12 px-6 text-[15px]",   // 48px
  sm:      "h-10 px-4 text-[13px]",   // 40px
  lg:      "h-14 px-8 text-[17px]",   // 56px
  icon:    "h-10 w-10",
};

function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    // Base: rounded-xl (16px), font-medium, smooth transition, press scale 0.97
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium",
    "transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.97]",
    variantStyles[variant],
    sizeStyles[size],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
