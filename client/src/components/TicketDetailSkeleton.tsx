import { Skeleton } from "./ui/skeleton";

export default function TicketDetailSkeleton() {
  return (
    <div className="grid grid-cols-[1fr_260px] gap-8">
      <div className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-40 w-full rounded-md" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
      </div>
    </div>
  );
}
