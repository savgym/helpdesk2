import type { DashboardStats } from "@helpdesk/core";
import { api } from "./api";

export const STATS_QUERY_KEY = ["dashboardStats"] as const;

export const fetchDashboardStats = (): Promise<DashboardStats> =>
  api.get<DashboardStats>("/stats");
