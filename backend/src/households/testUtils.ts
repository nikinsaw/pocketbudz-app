import type { PrismaClient, Role } from '@prisma/client';

export async function resetDb(prisma: PrismaClient) {
  await prisma.household.deleteMany();
  await prisma.user.deleteMany();
}

export function makeUser(prisma: PrismaClient, name: string) {
  return prisma.user.create({
    data: { googleSub: `sub-${name}`, email: `${name}@example.com`, name },
  });
}

export async function makeHousehold(
  prisma: PrismaClient,
  members: { userId: string; role: Role }[],
) {
  return prisma.household.create({
    data: { name: 'Test home', members: { create: members } },
    include: { members: true },
  });
}
