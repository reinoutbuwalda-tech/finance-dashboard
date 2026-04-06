import * as XLSX from "xlsx"

const OWN_ACCOUNTS = new Set([
  "NL64ABNA0107290138","NL75ABNA0107033569","NL76ABNA0140256342",
  "NL20ABNA0117044474","NL90ABNA0531172783","NL07RABO0399491228",
  "NL32RABO0379282186","NL20ABNA0152596720","NL46ABNA0145092429",
  "NL37ABNA0107292467","NL17ABNA0116531010","NL25ABNA0148096861",
])
const DEGIRO = "NL56BOFA0266201830"
const KNAB = "NL63KNAB0776828800"
const ASN_MORT = "NL60ASNB8832227606"

function extractIBAN(desc: string): string | null {
  const m = desc.match(/IBAN:\s*([A-Z]{2}\d{2}[A-Z0-9]{9,30})/i) || desc.match(/\/IBAN\/([A-Z]{2}\d{2}[A-Z0-9]{9,30})\//i)
  return m ? m[1].replace(/\s/g, "") : null
}

function isOwnAccount(desc: string): boolean {
  const iban = extractIBAN(desc)
  if (!iban) return false
  return OWN_ACCOUNTS.has(iban) || iban.endsWith(DEGIRO.slice(-6)) || iban.endsWith(KNAB.slice(-6)) || iban.endsWith(ASN_MORT.slice(-6))
}

function isHouseMoney(amount: number, iso: string, desc: string): boolean {
  if (amount > 0 && Math.abs(amount) >= 20000 && /2026-0[123]/.test(iso) && /buwalda/i.test(desc)) return true
  return false
}

function categorize(desc: string, amount: number): { category: string; type: "income" | "expense" } {
  const d = desc.toLowerCase()
  const a = Math.abs(amount)
  if (amount > 0) {
    const iban = extractIBAN(desc)
    if (iban && (iban.endsWith(DEGIRO.slice(-6)) || iban.endsWith(KNAB.slice(-6)) || iban.endsWith(ASN_MORT.slice(-6)))) return { category: "Investment Return", type: "income" }
    if (/\bsalaris\b|\bloon\b|\bwerkgever\b/.test(d)) return { category: "Salary", type: "income" }
    if (a >= 20000) return { category: "Large One-off", type: "income" }
    return { category: "Other Income", type: "income" }
  }
  if (/\balbert.heijn\b|\bjumbo\b|\blidl\b|\bpicnic\b/.test(d)) return { category: "Groceries", type: "expense" }
  if (/\bbol\.com\b|\bcoolblue\b|\bmedia.markt\b|\btemu\b|\balibaba\b|\bklarna\b|\bjysk\b|\binnr\b/.test(d)) return { category: "Shopping", type: "expense" }
  if (/\bnetflix\b|\bspotify\b|\bdisney\b|\bprime\b/.test(d)) return { category: "Subscriptions", type: "expense" }
  if (/\bint.card.services\b|\bnl13zzz332005960000\b/.test(d)) return { category: "Credit Card", type: "expense" }
  if (/\bnl77zzz342933670000\b/.test(d)) return { category: "Insurance", type: "expense" }
  if (/\basn.bank\b|\bnl60asnb\b|\bhypotheek\b|\bperiodieke.overb\b/.test(d) && a === 830) return { category: "Mortgage", type: "expense" }
  if (/\bhuur\b|\bmakelaar\b/.test(d)) return { category: "Housing", type: "expense" }
  if (/\bbunq\b/.test(d)) return { category: "Holiday Savings", type: "expense" }
  if (/\bvan.neerbos\b|\bshadid\b|\bvan.leeuwen\b|\bmeijer\b|\bbenamar\b|\blissone\b/.test(d)) return { category: "Friend Reimbursement", type: "expense" }
  if (/\brestaurant\b|\bcafe\b|\bbar\b|\blunch\b|\bpizza\b|\bsushi\b|\bkoffie\b/.test(d)) return { category: "Dining", type: "expense" }
  if (/\bapotheek\b|\bdokter\b|\bzorg\b/.test(d)) return { category: "Health", type: "expense" }
  if (/\bverzekering\b|\basr\b|\bnationale\b/.test(d)) return { category: "Insurance", type: "expense" }
  if (/\bkpn\b|\bvodafone\b|\bt-mobile\b|\bziggo\b/.test(d)) return { category: "Telecom", type: "expense" }
  if (/\bikea\b|\bgamma\b|\bkarwei\b/.test(d)) return { category: "Home", type: "expense" }
  if (/\bboek\b|\bcursus\b|\bstudie\b/.test(d)) return { category: "Education", type: "expense" }
  if (/\benergie\b|\belektra\b|\bgas\b/.test(d)) return { category: "Energy", type: "expense" }
  if (/\bgemeente\b|\bbelasting\b/.test(d)) return { category: "Government", type: "expense" }
  if (/\bgift\b|\bdonatie\b/.test(d)) return { category: "Gifts", type: "expense" }
  if (/\bbasispakket\b|\babn.amro\b/.test(d)) return { category: "Bank Fees", type: "expense" }
  if (/\bns\s|\btrein\b|\bshell\b|\btankstation\b/.test(d)) return { category: "Transport", type: "expense" }
  if (/\bhotel\b|\bflight\b|\bairbnb\b|\bbooking\b/.test(d)) return { category: "Travel", type: "expense" }
  if (/\bstichting\b/.test(d)) return { category: "Donation", type: "expense" }
  return { category: "Other", type: "expense" }
}

export interface ParsedTransaction {
  date: string; dateISO: string; month: string; description: string
  amount: number; category: string; type: "income" | "expense"; isFiltered: boolean
}

export function parseXLS(buffer: Buffer): ParsedTransaction[] {
  const wb = XLSX.read(buffer, { type: "buffer" })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]
  const result: ParsedTransaction[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (!row || row.length < 8) continue
    const dateVal = row[2]; const amount = Number(row[6]); const description = String(row[7] || "").trim()
    if (!dateVal || isNaN(amount) || !description) continue
    const ds = String(Math.floor(Number(dateVal)))
    const iso = `${ds.slice(0,4)}-${ds.slice(4,6)}-${ds.slice(6,8)}`
    if (isOwnAccount(description)) continue
    if (isHouseMoney(amount, iso, description)) continue
    const { category, type } = categorize(description, amount)
    result.push({ date: `${ds.slice(6,8)}-${ds.slice(4,6)}-${ds.slice(0,4)}`, dateISO: iso, month: iso.slice(0,7), description, amount, category, type, isFiltered: false })
  }
  return result
}
