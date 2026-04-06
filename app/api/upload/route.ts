import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseXLS } from "@/lib/parser"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Prisma } from "@prisma/client"

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const account = (formData.get("account") as string) || "ABN"
    const mode = (formData.get("mode") as string) || "replace"

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const transactions = parseXLS(buffer)

    if (transactions.length === 0) return NextResponse.json({ error: "No valid transactions found" }, { status: 400 })

    if (mode === "replace") await prisma.transaction.deleteMany({ where: { account } })

    const result = await prisma.transaction.createMany({
      data: transactions.map((t) => ({
        date: new Date(t.dateISO), month: t.month, description: t.description.slice(0, 500),
        amount: new Prisma.Decimal(String(t.amount)), category: t.category, type: t.type, account, isFiltered: t.isFiltered,
      })),
    })

    return NextResponse.json({ success: true, imported: result.count })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
