"use client";

import React, { useEffect, useState, Suspense } from "react";
import { Loader2, TrendingUp, Clock, AlertCircle } from "lucide-react";

interface MetricsData {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  avgResolutionHours: number;
}

const LazyAdminCharts = React.lazy(() => import("./LazyAdminCharts"));

export default function MetricsTab() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/metrics");
      if (!res.ok) throw new Error("Error cargando métricas");
      const json = await res.json();
      setData(json);
    } catch {
      setError("No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500">
        <AlertCircle className="w-8 h-8 mb-2" />
        <p>{error}</p>
        <button
          onClick={fetchMetrics}
          className="mt-4 text-blue-500 text-sm hover:underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Transform data for Charts component
  const statusData = Object.entries(data.byStatus).map(([name, value]) => ({
    name,
    value,
  }));

  const categoryData = Object.entries(data.byCategory).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI CARDS */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-full text-blue-600">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Tickets</p>
            <h3 className="text-2xl font-bold text-gray-800">{data.total}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-full text-green-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">
              Tiempo Promedio Resolución
            </p>
            <h3 className="text-2xl font-bold text-gray-800">
              {data.avgResolutionHours} hrs
            </h3>
          </div>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="h-[400px] flex items-center justify-center bg-gray-50 rounded-xl">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        }
      >
        <LazyAdminCharts statusData={statusData} categoryData={categoryData} />
      </Suspense>
    </div>
  );
}
