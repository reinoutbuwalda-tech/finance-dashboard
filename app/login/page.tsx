"use client"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [pw, setPw] = useState("")
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setErr("")
    const result = await signIn("credentials", { password: pw, redirect: false })
    if (result?.error) { setErr("Verkeerd wachtwoord"); setLoading(false) }
    else router.push("/")
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 w-full max-w-sm">
        <div className="text-center mb-8"><div className="text-4xl mb-3">💶</div><h1 className="text-xl font-bold text-white">Finance Dashboard</h1><p className="text-slate-500 text-sm mt-1">Voer je wachtwoord in</p></div>
        <form onSubmit={submit} className="space-y-4">
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Wachtwoord"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"/>
          {err && <p className="text-red-400 text-sm text-center">{err}</p>}
          <button type="submit" disabled={loading || !pw}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors">
            {loading ? "Inloggen..." : "Inloggen"}
          </button>
        </form>
      </div>
    </div>
  )
}
