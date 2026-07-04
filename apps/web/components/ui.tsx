import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-brand-500 text-ink-950 hover:bg-brand-400",
        secondary: "bg-ink-800 text-ink-50 hover:bg-ink-600",
        outline: "border border-ink-600 text-ink-50 hover:bg-ink-800",
        ghost: "text-ink-100 hover:bg-ink-800",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8 text-base",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-ink-800 bg-ink-900 p-6", className)}
      {...props}
    />
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[120px] w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "outline" | "success" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant === "default" && "bg-brand-500/15 text-brand-400",
        variant === "outline" && "border border-ink-600 text-ink-100",
        variant === "success" && "bg-emerald-500/15 text-emerald-400",
        className,
      )}
      {...props}
    />
  );
}
