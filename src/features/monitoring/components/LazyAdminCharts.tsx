"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface ChartProps {
  statusData: { name: string; value: number }[];
  categoryData: { name: string; value: number }[];
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function LazyAdminCharts({
  statusData,
  categoryData,
}: ChartProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* CHART 1: STATUS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
        <h3 className="text-lg font-bold text-gray-700 mb-4">
          Tickets por Estado
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={statusData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* CHART 2: CATEGORIES */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
        <h3 className="text-lg font-bold text-gray-700 mb-4">
          Categorías más frecuentes
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({
                name,
                percent,
              }: {
                name?: string | number;
                percent?: number;
              }) => `${name || ""} ${((percent || 0) * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {categoryData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
