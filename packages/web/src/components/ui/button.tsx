import * as React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "destructive" | "ghost" | "link" | "outline";
  size?: "default" | "sm" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center rounded-none font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-40 disabled:cursor-not-allowed";

    const variantStyles = {
      default: "bg-accent-primary text-accent-on-primary hover:opacity-90",
      secondary: "border border-border-subtle bg-canvas text-fg-primary hover:bg-surface",
      destructive: "bg-state-danger text-white hover:opacity-90",
      ghost: "text-fg-primary hover:bg-surface",
      link: "text-fg-primary underline decoration-fg-muted hover:decoration-fg-primary",
      outline: "border border-border-subtle bg-canvas text-fg-primary hover:bg-surface",
    };

    const sizeStyles = {
      default: "px-4 py-2 text-body",
      sm: "px-3 py-1.5 text-small",
      lg: "px-6 py-3 text-body",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

