import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
}

export default function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: StatCardProps) {
  return (
    <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            {title}
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 to-fuchsia-600 text-white shadow-lg">
          <Icon size={22} />
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-600">{description}</p>
    </div>
  );
}
