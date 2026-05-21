import prisma from "./prisma";

let cachedId: string | null | undefined;

export async function getAIAgentId(): Promise<string | null> {
  if (cachedId !== undefined) return cachedId;
  const agent = await prisma.user.findUnique({
    where: { email: "ai@helpdesk.internal" },
    select: { id: true },
  });
  cachedId = agent?.id ?? null;
  return cachedId;
}
