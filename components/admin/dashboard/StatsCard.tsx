import React from "react";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: number | string;
  subtext?: string;
  icon: LucideIcon;
  borderColorClass: string; // e.g. "border-sena-green"
  iconColorClass: string; // e.g. "text-sena-green"
  onClick?: () => void;
  className?: string; // For passing dnd styles
  isInteractive?: boolean; // If true, shows hover effects
}

export function StatsCard({
  title,
  value,
  subtext,
  icon: Icon,
  borderColorClass,
  iconColorClass,
  onClick,
  className = "",
  isInteractive = false,
}: StatsCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white p-6 rounded-xl shadow-sm border-b-4 ${borderColorClass} flex justify-between items-center transition ${
        isInteractive ? "cursor-pointer hover:shadow-md" : "cursor-default"
      } ${className}`}
    >
      <div>
        <p className="text-gray-500 text-xs font-bold uppercase">{title}</p>
        <h2 className="text-3xl font-bold text-gray-800">
          {value}{" "}
          {subtext && (
            <span className="text-sm font-normal text-gray-400">{subtext}</span>
          )}
        </h2>
      </div>
      <Icon className={`w-10 h-10 opacity-20 ${iconColorClass}`} />
    </div>
  );
}
