import { Skeleton } from "@/components/ui/Skeleton";

export function TicketsTableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="animate-in fade-in duration-300">
          <td className="p-4">
            <Skeleton className="h-4 w-8" />
          </td>
          <td className="p-4">
            <Skeleton className="h-5 w-16 rounded-full" />
          </td>
          <td className="p-4">
            <Skeleton className="h-5 w-20 rounded-full" />
          </td>
          <td className="p-4">
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-3 w-20 opacity-70" />
          </td>
          <td className="p-4">
            <Skeleton className="h-4 w-24" />
          </td>
          <td className="p-4">
            <Skeleton className="h-4 w-24" />
          </td>
          <td className="p-4">
            <Skeleton className="h-4 w-20" />
          </td>
        </tr>
      ))}
    </>
  );
}
