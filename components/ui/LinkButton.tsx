import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";
import { buttonClasses, type ButtonVariant } from "./Button";

interface Props extends LinkProps {
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}

// A next/link rendered with Button styling — for navigation CTAs (e.g. "Start
// review") that should look and behave like a primary/secondary button.
export function LinkButton({ variant = "primary", className = "", children, ...props }: Props) {
  return (
    <Link className={buttonClasses(variant, className)} {...props}>
      {children}
    </Link>
  );
}
