import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // Solid teal — primary action badge
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-border text-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline:
          "text-foreground border border-border",
        // Tinted teal — e.g. "Week 4 / 12" on workout screen
        tinted:
          "border border-primary/20 bg-primary/10 text-primary",
        // Warning tinted
        warning:
          "border border-warning/20 bg-warning/10 text-warning",
        // Success tinted
        success:
          "border border-success/20 bg-success/10 text-success",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
