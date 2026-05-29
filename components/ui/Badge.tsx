import type { HTMLAttributes } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

const tones: Record<Tone, string> = {
  neutral: "bg-subtle text-secondary",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  accent: "bg-accent-subtle text-accent-strong",
};

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className = "", ...props }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-caption uppercase tracking-[0.02em] ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
