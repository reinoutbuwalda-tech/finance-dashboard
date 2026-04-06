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
    prisma.transaction.groupBy({
      by: ["type", "category"],
      where,
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.transaction.groupBy({
      by: ["month"],
      where: { account, isFiltered: false },
      _sum: { amount: true },
      _count: { id: true },
    }),
  ])

  // Convert Prisma Decimal to plain numbers before JSON serialization
  const toFloat = (v: unknown): number => {
    if (v == null) return 0
    if (typeof v === "number") return isNaN(v) ? 0 : v
    if (typeof v === "object" && v !== null) {
      const d = v as Record<string, unknown>
      if (typeof d.toString === "function") return parseFloat(d.toString())
    }
    const n = parseFloat(String(v).replace(",", "."))
    return isNaN(n) ? 0 : n
  }

  return NextResponse.json({
    transactions: transactions.map((tx) => ({ ...tx, amount: toFloat(tx.amount) })),
    stats: stats.map((s) => ({ ...s, _sum: { amount: toFloat(s._sum.amount) } })),
    monthly: monthly.map((m) => ({ ...m, _sum: { amount: toFloat(m._sum.amount) } })),
  })
}
