import type { Request, Response } from "express";
import type { DashboardStats } from "@helpdesk/core";
import prisma from "../lib/prisma";

export async function getDashboardStats(_req: Request, res: Response) {
  const rows = await prisma.$queryRaw<[{ get_dashboard_stats: DashboardStats }]>`
    SELECT get_dashboard_stats()
  `;
  res.json(rows[0].get_dashboard_stats);
}
