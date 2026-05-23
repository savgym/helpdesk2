import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, Clock, Sparkles, TrendingUp, Timer } from "lucide-react";
import type { DashboardStats } from "@helpdesk/core";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { STATS_QUERY_KEY, fetchDashboardStats } from "../lib/stats";

function formatAvgTime(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes}m`;
  const totalHours = Math.floor(minutes / 60);
  if (totalHours < 24) return `${totalHours}h`;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
}

function formatAxisDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
}

function StatCard({ title, value, icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className="text-muted-foreground/60">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useQuery<DashboardStats, Error>({
    queryKey: STATS_QUERY_KEY,
    queryFn: fetchDashboardStats,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-4 py-3">
          {error.message}
        </div>
      )}

      {isLoading ? (
        <>
          <StatsSkeleton />
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        </>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard
              title="Total Tickets"
              value={stats.totalTickets}
              icon={<LayoutGrid className="h-4 w-4" />}
            />
            <StatCard
              title="Open Tickets"
              value={stats.openTickets}
              icon={<Clock className="h-4 w-4" />}
            />
            <StatCard
              title="Resolved by AI"
              value={stats.resolvedByAI}
              icon={<Sparkles className="h-4 w-4" />}
            />
            <StatCard
              title="AI Resolution Rate"
              value={`${stats.resolvedByAIPercent}%`}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatCard
              title="Avg Resolution Time"
              value={formatAvgTime(stats.avgResolutionMinutes)}
              icon={<Timer className="h-4 w-4" />}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tickets Per Day
              </CardTitle>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.ticketsPerDay} barCategoryGap="30%">
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatAxisDate}
                    tick={{ fontSize: 11, fontFamily: "Outfit, sans-serif" }}
                    tickLine={false}
                    axisLine={false}
                    interval={4}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fontFamily: "Outfit, sans-serif" }}
                    tickLine={false}
                    axisLine={false}
                    width={24}
                  />
                  <Tooltip
                    formatter={(value) => [value, "Tickets"]}
                    labelFormatter={(label) =>
                      typeof label === "string" ? formatAxisDate(label) : label
                    }
                    cursor={{ fill: "oklch(0.97 0 0)" }}
                    contentStyle={{
                      fontFamily: "Outfit, sans-serif",
                      fontSize: 12,
                      borderRadius: 8,
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="oklch(0.541 0.281 293)"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
