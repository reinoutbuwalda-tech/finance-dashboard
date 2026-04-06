import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get("month")
  const account = searchParams.get("account") || "ABN"

  const where: Record<string, unknown> = { account, isFiltered: false }
  if (month) where.month = month

  const [transactions, stats, monthly] = await Promise.all([
    prisma.transaction.findMany({ where, orderBy: { date: "desc" }, take: 500 }),
    prisma.transaction.groupBy({ by: ["type", "category"], where: { account, isFiltered: false, ...(month ? { month } : {}) }, _sum: { amount: true }, _count: { id: true } }),
    prisma.transaction.groupBy({ by: ["month"], where: { account, isFiltered: false }, _sum: { amount: true }, _count: { id: true } }),
  ])

  return NextResponse.json({ transactions, stats, monthly })
}
