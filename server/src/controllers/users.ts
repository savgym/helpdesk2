import type { Request, Response } from "express";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { z } from "zod";
import { createUserSchema } from "@helpdesk/core";
import prisma from "../lib/prisma";

const authAdmin = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "AGENT"], { message: "Invalid role" }),
});

export async function listUsers(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    select: USER_SELECT,
    orderBy: { createdAt: "asc" },
  });
  res.json(users);
}

export async function createUser(req: Request, res: Response) {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues[0].message });
  }

  const { name, email, password } = result.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ error: "A user with that email already exists" });
  }

  await authAdmin.api.signUpEmail({ body: { name, email: normalizedEmail, password } });
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: normalizedEmail },
    select: USER_SELECT,
  });
  res.status(201).json(user);
}

export async function updateRole(req: Request, res: Response) {
  const id = req.params.id as string;
  const requestingUserId = res.locals.session.user.id;

  if (id === requestingUserId) {
    return res.status(400).json({ error: "You cannot change your own role" });
  }

  const result = updateRoleSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues[0].message });
  }

  const { role } = result.data;

  if (role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount >= 1) {
      return res.status(400).json({ error: "There can only be one admin" });
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role },
    select: USER_SELECT,
  });
  res.json(user);
}

export async function deleteUser(req: Request, res: Response) {
  const id = req.params.id as string;
  const requestingUserId = res.locals.session.user.id;

  if (id === requestingUserId) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }

  await prisma.user.delete({ where: { id } });
  res.status(204).send();
}
