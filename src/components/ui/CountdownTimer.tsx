import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export const CountdownTimer = ({ targetDate }: { targetDate?: string }) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [isBreached, setIsBreached] = useState(false);

  useEffect(() => {
    if (!targetDate) return;

    const calculate = () => {
      const now = new Date().getTime();
      const end = new Date(targetDate || "").getTime();
      const diff = end - now;

      if (diff <= 0) {
        setIsBreached(true);
        setTimeLeft("00h 00m");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${hours}h ${minutes}m`);
    };

    calculate();
    const interval = setInterval(calculate, 60000); // Actualizar cada minuto
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!targetDate) return null;

  return (
    <span
      className={`text-xs font-bold font-mono px-2 py-0.5 rounded flex items-center gap-1 ${
        isBreached
          ? "bg-red-600 text-white animate-pulse"
          : "bg-gray-100 text-gray-700"
      }`}
    >
      <Clock className="w-3 h-3" />
      {isBreached ? "VENCIDO" : timeLeft}
    </span>
  );
};
