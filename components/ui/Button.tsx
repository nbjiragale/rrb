import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center rounded-md font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover px-5 py-2.5 text-body",
  secondary:
    "bg-surface text-primary border border-border-strong hover:bg-hover px-5 py-2.5 text-body",
  ghost: "text-secondary hover:bg-hover hover:text-primary px-3 py-2 text-body",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", className = "", ...props }, ref) => (
    <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...props} />
  )
);
Button.displayName = "Button";
