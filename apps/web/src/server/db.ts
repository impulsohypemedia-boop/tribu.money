import { PrismaClient } from '@prisma/client'

// Next dev hot-reloads modules; without the global cache every reload opens a
// fresh connection pool until Postgres refuses new connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// The default 5s interactive-transaction budget is tight when the database sits in another
// region from the functions: a room creation makes a dozen round trips inside one transaction.
export const prisma =
    globalForPrisma.prisma ?? new PrismaClient({ transactionOptions: { timeout: 15_000, maxWait: 10_000 } })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
