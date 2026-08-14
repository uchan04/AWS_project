import { PrismaClient } from "@prisma/client"

// 개발 중 hot reload로 PrismaClient가 계속 새로 만들어지면 RDS 커넥션이 고갈된다.
// globalThis에 하나만 붙여 재사용한다.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
