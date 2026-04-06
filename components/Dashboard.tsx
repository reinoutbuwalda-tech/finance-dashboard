"use client"
import { useState, useEffect, useCallback } from "react"
import { useSession, signOut } from "next-auth/react"

interface Transaction { id: string; date: string; description: string; amount: string; category: string; type: string }
interface MonthStat { month: string; _sum: { amount: string | number | null }; _count: { id: number } }
interface CatStat { category: string; type: string | null; _sum: { amount: string | number | null }; _count: { id: number } }

const ML: Record<string, string> = { "01":"Jan","02":"Feb","03":"Mrt","04":"Apr","05":"Mei","06":"Jun","07":"Jul","08":"Aug","09":"Sep","10":"Okt","11":"Nov","12":"Dec" }

function toNum(v: string | number | null | undefined): number {
  if (v == null) return 0
  if (typeof v === "number") return isNaN(v) ? 0 : v
  const s = String(v).replace(",", ".")
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

export default function Dashboard() {
  const { data: session } = useSession()
  const [activeMonth, setActiveMonth] = useState("")
  const [txs, setTxs] = useState<Transaction[]>([])
  const [monthly, setMonthly] = useState<MonthStat[]>([])
  const [cats, setCats] = useState<CatStat[]>([])
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<{ok: boolean; text: string} | null>(null)

  const fetchData = useCallback(async (month?: string) => {
    const url = month ? `/api/transactions?month=${month}` : "/api/transactions"
    const r = await fetch(url)
    if (!r.ok) return
    const d = await r.json()
    setTxs(d.transactions || [])
    setMonthly(d.monthly || [])
    setCats(d.stats || [])
    if (d.monthly?.length && !activeMonth) {
      const sorted = [...d.monthly].sort((a: MonthStat, b: MonthStat) => b.month.localeCompare(a.month))
      setActiveMonth(sorted[0].month)
    }
  }, [activeMonth])

  useEffect(() => { fetchData() }, [])
  useEffect(() => { if (activeMonth) fetchData(activeMonth) }, [activeMonth])

  // Separate income and expense categories
  const expCats = cats.filter(c => c.type === "expense" || toNum(c._sum?.amount) < 0)
  const incCats = cats.filter(c => c.type === "income" || toNum(c._sum?.amount) > 0)
  const totalExpense = expCats.reduce((s, c) => s + Math.abs(toNum(c._sum?.amount)), 0)
  const totalIncome = incCats.reduce((s, c) => s + toNum(c._sum?.amount), 0)
  const net = totalIncome - totalExpense
  const maxCat = totalExpense > 0 ? totalExpense : 1
  const sortedMonths = [...monthly].sort((a, b) => b.month.localeCompare(a.month))
  const [y, mo] = activeMonth ? activeMonth.split("-") : ["", ""]

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setMsg(null)
    const fd = new FormData()
    fd.append("file", file); fd.append("mode", "replace"); fd.append("account", "ABN")
    const r = await fetch("/api/upload", { method: "POST", body: fd })
    const d = await r.json()
    setUploading(false)
    if (d.success) { setMsg({ ok: true, text: `${d.imported} transacties geïmporteerd` }); fetchData() }
    else setMsg({ ok: false, text: d.error || "Upload mislukt" })
  }

  function fmtDate(dateStr: string) {
    if (!dateStr) return "--"
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return String(dateStr).slice(0,5)
      return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit" })
    } catch { return "--" }
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div><h1 className="text-xl font-bold text-white">💶 Finance Dashboard</h1><p className="text-sm text-slate-400">{ML[mo]} {y}</p></div>
          <div className="flex items-center gap-4">
            <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              {uploading ? "⏳..." : "📤 XLS Uploaden"}<input type="file" accept=".xls,.xlsx" onChange={handleUpload} className="hidden" disabled={uploading} />
            </label>
            <button onClick={() => signOut()} className="text-slate-400 hover:text-white text-sm">Uitloggen</button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-6">
        {msg && <div className={`mb-4 p-3 rounded-lg text-sm ${msg.ok ? "bg-emerald-900/50 text-emerald-300" : "bg-red-900/50 text-red-300"}`}>{msg.text}</div>}
        <div className="flex gap-2 flex-wrap mb-6">
          {sortedMonths.map(m => {
            const [yr, mo2] = m.month.split("-")
            return <button key={m.month} onClick={() => setActiveMonth(m.month)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${activeMonth === m.month ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
              {ML[mo2]} {yr}
            </button>
          })}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800"><p className="text-xs uppercase text-slate-500 mb-1">Inkomsten</p><p className="text-2xl font-bold text-emerald-400">€{Math.abs(totalIncome).toLocaleString("nl-NL",{minimumFractionDigits:0})}</p></div>
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800"><p className="text-xs uppercase text-slate-500 mb-1">Uitgaven</p><p className="text-2xl font-bold text-red-400">€{totalExpense.toLocaleString("nl-NL",{minimumFractionDigits:0})}</p></div>
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800"><p className="text-xs uppercase text-slate-500 mb-1">Netto</p><p className={`text-2xl font-bold ${net>=0?"text-emerald-400":"text-red-400"}`}>€{Math.abs(net).toLocaleString("nl-NL",{minimumFractionDigits:0})}</p></div>
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800"><p className="text-xs uppercase text-slate-500 mb-1">Transacties</p><p className="text-2xl font-bold text-slate-300">{txs.length}</p></div>
        </div>
        <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 mb-6">
          <h2 className="text-xs uppercase text-slate-500 mb-4">Uitgaven per categorie</h2>
          <div className="space-y-3">
            {expCats.map(cat => {
              const amt = Math.abs(toNum(cat._sum?.amount))
              const pct = Math.round((amt / maxCat) * 100)
              return <div key={cat.category} className="flex items-center gap-3">
                <span className="text-sm text-slate-300 w-44 flex-shrink-0 truncate">{cat.category}</span>
                <div className="flex-1 bg-slate-800 rounded-full h-2"><div className="bg-red-500 h-2 rounded-full" style={{width:`${pct}%`}}/></div>
                <span className="text-sm text-slate-400 w-24 text-right flex-shrink-0">€{amt.toLocaleString("nl-NL",{minimumFractionDigits:0})}</span>
                <span className="text-xs text-slate-600 w-6 text-right">{cat._count?.id || 0}x</span>
              </div>
            })}
          </div>
        </div>
        <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
          <h2 className="text-xs uppercase text-slate-500 mb-4">Transacties</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-slate-500 border-b border-slate-800 text-left">
                <th className="pb-3 pr-4">Datum</th><th className="pb-3 pr-4">Omschrijving</th><th className="pb-3 pr-4">Cat</th><th className="pb-3 text-right">Bedrag</th>
              </tr></thead>
              <tbody>
                {txs.slice(0,60).map(tx => (
                  <tr key={tx.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-2.5 pr-4 text-slate-400">{fmtDate(tx.date)}</td>
                    <td className="py-2.5 pr-4 text-slate-300 truncate max-w-xs">{tx.description}</td>
                    <td className="py-2.5 pr-4"><span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{tx.category}</span></td>
                    <td className={`py-2.5 text-right font-medium ${tx.type==="income"?"text-emerald-400":"text-red-400"}`}>
                      {tx.type==="income"?"+":"-"}€{Math.abs(toNum(tx.amount)).toLocaleString("nl-NL",{minimumFractionDigits:2})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
