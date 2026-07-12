import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-white/60 bg-white/90 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur",
        className,
      )}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
