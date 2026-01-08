"use client";

import React, { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { Activity, BarChart3, Monitor } from "lucide-react";
import { SortableStatsCard } from "./SortableStatsCard";
import {
  Stats,
  Agent,
  AdminTab,
  TicketFilterType,
} from "@/app/admin/admin.types";

// Import user type if available or define compatible shape

interface DraggableDashboardProps {
  stats: Stats;
  currentUser: Agent | null;
  setActiveTab: (tab: AdminTab) => void;
  setTicketFilter: (filter: TicketFilterType) => void;
}

export default function DraggableDashboard({
  stats,
  currentUser,
  setActiveTab,
  setTicketFilter,
}: DraggableDashboardProps) {
  const [items, setItems] = useState([
    "total-tickets",
    "pending-tickets",
    "total-assets",
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    const savedOrder = localStorage.getItem("dashboard-order");
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        // Verify all IDs exist in current version
        if (
          Array.isArray(parsed) &&
          parsed.length === 3 &&
          parsed.includes("total-tickets")
        ) {
          // eslint-disable-next-line
          setItems(parsed);
        }
      } catch (e) {
        console.error("Failed to parse dashboard order", e);
      }
    }
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem("dashboard-order", JSON.stringify(newOrder));
        return newOrder;
      });
    }
  };

  const widgets = {
    "total-tickets": (
      <SortableStatsCard
        key="total-tickets"
        id="total-tickets"
        title="Gestión Total"
        value={stats.totalTickets}
        subtext="tickets"
        icon={Activity}
        borderColorClass="border-sena-green"
        iconColorClass="text-sena-green"
        isInteractive={currentUser?.role !== "superadmin"}
        onClick={() => {
          if (currentUser?.role !== "superadmin") {
            setActiveTab("tickets");
            setTicketFilter("ALL");
          }
        }}
      />
    ),
    "pending-tickets": (
      <SortableStatsCard
        key="pending-tickets"
        id="pending-tickets"
        title="Pendientes"
        value={stats.pendingTickets}
        subtext="tickets"
        icon={BarChart3}
        borderColorClass="border-red-500"
        iconColorClass="text-red-500"
        isInteractive={currentUser?.role !== "superadmin"}
        onClick={() => {
          if (currentUser?.role !== "superadmin") {
            setActiveTab("tickets");
            setTicketFilter("PENDING");
          }
        }}
      />
    ),
    "total-assets": (
      <SortableStatsCard
        key="total-assets"
        id="total-assets"
        title="Inventario Total"
        value={stats.totalAssets}
        subtext="equipos"
        icon={Monitor}
        borderColorClass="border-blue-500"
        iconColorClass="text-blue-500"
        isInteractive={true}
        onClick={() => setActiveTab("assets")}
      />
    ),
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items} strategy={rectSortingStrategy}>
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {items.map((id) => widgets[id as keyof typeof widgets])}
        </section>
      </SortableContext>
    </DndContext>
  );
}
