import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { StatsCard } from "./StatsCard";
import { LucideIcon } from "lucide-react";

interface SortableStatsCardProps {
  id: string;
  title: string;
  value: number | string;
  subtext?: string;
  icon: LucideIcon;
  borderColorClass: string;
  iconColorClass: string;
  onClick?: () => void;
  isInteractive?: boolean;
}

export function SortableStatsCard(props: SortableStatsCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <StatsCard {...props} className="h-full touch-none" />
    </div>
  );
}
