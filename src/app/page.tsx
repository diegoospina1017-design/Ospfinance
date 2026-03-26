'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useState, useEffect, useMemo, useCallback } from 'react'

// ============================================================
// SUPABASE CLIENT
// ============================================================
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ============================================================
// TYPES
// ============================================================
type EntryType = 'gasto' | 'ahorro' | 'retiro'
type PersonType = 'Diego' | 'Kelly' | 'Compartido'

interface Category { id: string; name: string; icon: string; color: string; is_default: boolean }
interface Entry { id: string; type: EntryType; person: PersonType; amount: number; category_id: string; note: string; entry_date: string }
interface Budget { total_budget: number; cat_budgets: Record<string,number> }
interface SettleCfg { anchor_date: string; interval_days: number }
interface Settlement { id: string; period_label: string; period_key: string; total: number; share: number; diego_paid: number; kelly_paid: number; owes_from?: string; owes_to?: string; owes_amount?: number; settled_date: string }

// ============================================================
// DATE UTILS
// ============================================================
function localDate(s: string) { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d) }
function dateStr(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function addDays(s: string, n: number) { const d=localDate(s); d.setDate(d.getDate()+n); return dateStr(d) }
function todayStr() { return dateStr(new Date()) }
function fmtDate(s: string) { return localDate(s).toLocaleDateString('es-CO',{day:'2-digit',month:'short'}) }
function fmtMonth(ym: string) { const [y,m]=ym.split('-').map(Number); return new Date(y,m-1,1).toLocaleDateString('es-CO',{month:'short',year:'2-digit'}) }

// ============================================================
// PERIOD ENGINE
// ============================================================
function buildPeriods(anchorDate: string, intervalDays: number) {
  const today = todayStr()
  const periods: any[] = []
  let bEnd = anchorDate
  for (let i=0;i<80;i++) {
    const bStart = addDays(bEnd,-(intervalDays-1))
    periods.unshift({start:bStart,end:bEnd,label:`${fmtDate(bStart)} – ${fmtDate(bEnd)}`,key:bStart})
    bEnd = addDays(bStart,-1)
    if (bStart < '2024-01-01') break
  }
  let fStart = addDays(anchorDate,1)
  for (let i=0;i<20;i++) {
    const fEnd = addDays(fStart,intervalDays-1)
    periods.push({start:fStart,end:fEnd,label:`${fmtDate(fStart)} – ${fmtDate(fEnd)}`,key:fStart})
    if (fStart > today && i>=1) break
    fStart = addDays(fEnd,1)
  }
  return periods
}

function getCurrentPeriod(anchorDate: string, intervalDays: number) {
  const today = todayStr()
  const periods = buildPeriods(anchorDate,intervalDays)
  return periods.find(p=>today>=p.start&&today<=p.end) || [...periods].reverse().find(p=>p.end<=today) || periods[0]
}

function getPeriodEntries(entries: Entry[], period: any) {
  return entries.filter(e=>e.type==='gasto'&&e.entry_date>=period.start&&e.entry_date<=period.end)
}

// ============================================================
// SETTLEMENT ENGINE
// ============================================================
function calcSettlement(gastos: Entry[]) {
  const total = gastos.reduce((s,e)=>s+e.amount,0)
  const share = total/2
  let dPaid=0, kPaid=0
  gastos.forEach(e=>{
    if(e.person==='Compartido'){dPaid+=e.amount/2;kPaid+=e.amount/2}
    else if(e.person==='Diego') dPaid+=e.amount
    else kPaid+=e.amount
  })
  const dBal=dPaid-share, kBal=kPaid-share
  let owes=null as any
  if(Math.abs(dBal)>0.5) owes=dBal>0?{from:'Kelly',to:'Diego',amount:parseFloat(Math.abs(dBal).toFixed(2))}:{from:'Diego',to:'Kelly',amount:parseFloat(Math.abs(dBal).toFixed(2))}
  return {total,share,dPaid,kPaid,dBal,kBal,owes}
}

// ============================================================
// HELPERS
// ============================================================
const fmt = (n: number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n)
const fmtS = (n: number) => n>=1e6?`$${(n/1e6).toFixed(1)}M`:n>=1000?`$${(n/1000).toFixed(1)}k`:`$${Math.round(n)}`
const getCat = (id: string, cats: Category[]) => cats.find(c=>c.id===id)||{name:'Otros',icon:'📦',color:'#94a3b8',id:'',is_default:false}
const monthKey = (s: string) => s.slice(0,7)
const monthOf = (entries: Entry[], mk: string) => entries.filter(e=>e.entry_date.startsWith(mk))
const allMonths = (entries: Entry[]) => [...new Set(entries.map(e=>monthKey(e.entry_date)))].sort().reverse()

// ============================================================
// STYLES
// ============================================================
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Sora:wght@600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0b0d14;--bg2:#12151f;--bg3:#1a1e2e;
  --bd:rgba(255,255,255,.07);--bd2:rgba(255,255,255,.12);
  --tx:#eef0f8;--mt:#6b7494;--mt2:#9ba3c4;
  --ac:#4f7cff;--ag:linear-gradient(135deg,#4f7cff,#7c5cfc);
  --gn:#22c55e;--rd:#f43f5e;--yw:#fbbf24;
  --r:16px;--rs:10px;
}
html,body{height:100%;background:var(--bg);font-family:'DM Sans',sans-serif;color:var(--tx);-webkit-font-smoothing:antialiased}
.app{max-width:430px;margin:0 auto;min-height:100dvh;display:flex;flex-direction:column;background:var(--bg)}
.hdr{padding:50px 18px 10px;display:flex;justify-content:space-between;align-items:flex-start}
.hdr-t{font-family:'Sora',sans-serif;font-size:21px;font-weight:800;letter-spacing:-.5px}
.hdr-s{font-size:12px;color:var(--mt);margin-top:2px}
.body{flex:1;overflow-y:auto;padding:0 14px 100px}
.body::-webkit-scrollbar{display:none}
.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;
  background:rgba(18,21,31,.96);border-top:1px solid var(--bd);
  display:flex;align-items:flex-end;padding:6px 2px calc(8px + env(safe-area-inset-bottom));z-index:100;backdrop-filter:blur(24px)}
.ni{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 0;cursor:pointer;min-width:0}
.ni-ic{font-size:16px;transition:transform .2s}
.ni-lb{font-size:9px;font-weight:600;color:var(--mt);transition:color .2s;white-space:nowrap}
.ni.on .ni-lb{color:var(--ac)}.ni.on .ni-ic{transform:scale(1.15)}
.nav-add{width:44px;height:44px;background:var(--ag);border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-size:22px;color:#fff;cursor:pointer;
  box-shadow:0 4px 18px rgba(79,124,255,.45);margin-bottom:2px}
.mbar{display:flex;gap:6px;overflow-x:auto;padding:0 0 10px}
.mbar::-webkit-scrollbar{display:none}
.mc{padding:6px 14px;background:var(--bg2);border:1px solid var(--bd);border-radius:20px;
  font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;color:var(--mt2)}
.mc.on{background:rgba(79,124,255,.13);border-color:var(--ac);color:var(--ac)}
.card{background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r);padding:16px;margin-bottom:11px}
.csm{background:var(--bg3);border:1px solid var(--bd);border-radius:var(--rs);padding:13px}
.hero{background:linear-gradient(145deg,#131d3a,#0c1220);border:1px solid rgba(79,124,255,.18);border-radius:20px;padding:20px;margin-bottom:12px;position:relative;overflow:hidden}
.hero::after{content:'';position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(79,124,255,.12),transparent 70%);pointer-events:none}
.hl{font-size:11px;color:var(--mt);letter-spacing:.6px;text-transform:uppercase;margin-bottom:4px}
.ha{font-family:'Sora',sans-serif;font-size:34px;font-weight:800;letter-spacing:-1.5px;line-height:1}
.hg{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:16px}
.hs{background:rgba(255,255,255,.04);border-radius:11px;padding:11px}
.hs-l{font-size:11px;color:var(--mt);margin-bottom:3px}
.hs-v{font-size:17px;font-weight:800;font-family:'Sora',sans-serif}
.sc{border-radius:20px;padding:20px;margin-bottom:12px}
.sc.bal{background:linear-gradient(145deg,#0d2010,#091408);border:1px solid rgba(34,197,94,.2)}
.sc.owe{background:linear-gradient(145deg,#1e1408,#120d04);border:1px solid rgba(251,191,36,.25)}
.sc.set{background:linear-gradient(145deg,#0d1a2e,#091020);border:1px solid rgba(79,124,255,.2)}
.sbdg{display:inline-flex;font-size:10px;font-weight:800;padding:3px 10px;border-radius:20px;text-transform:uppercase;margin-bottom:10px}
.sbdg.ok{background:rgba(34,197,94,.15);color:var(--gn)}
.sbdg.pe{background:rgba(251,191,36,.15);color:var(--yw)}
.sbdg.dn{background:rgba(79,124,255,.15);color:var(--ac)}
.ss{font-family:'Sora',sans-serif;font-size:19px;font-weight:800;line-height:1.25;margin-bottom:3px}
.su{font-size:12px;color:var(--mt2)}
.sec{display:flex;justify-content:space-between;align-items:center;margin:16px 0 9px}
.sec-t{font-size:14px;font-weight:700}
.sec-a{font-size:13px;color:var(--ac);cursor:pointer}
.er{display:flex;align-items:center;gap:10px;padding:11px 13px;background:var(--bg2);border-radius:12px;margin-bottom:6px;border:1px solid var(--bd);cursor:pointer}
.er:active{background:var(--bg3)}
.ei{width:37px;height:37px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.en{flex:1;min-width:0}
.enm{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.emt{font-size:11px;color:var(--mt);margin-top:2px;display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.eam{font-size:14px;font-weight:800;flex-shrink:0}
.eam.gasto{color:var(--rd)}.eam.ahorro{color:var(--gn)}.eam.retiro{color:var(--rd)}
.bdg{display:inline-flex;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px}
.bdg.Diego{background:rgba(79,124,255,.15);color:#7aa3ff}
.bdg.Kelly{background:rgba(236,72,153,.15);color:#f472b6}
.bdg.Compartido{background:rgba(124,92,252,.15);color:#b197fc}
.fg{margin-bottom:14px}
.fl{font-size:11px;font-weight:700;color:var(--mt);letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px;display:block}
.fi{width:100%;background:var(--bg3);border:1px solid var(--bd);border-radius:var(--rs);padding:12px 14px;font-size:15px;color:var(--tx);font-family:inherit;outline:none;transition:border-color .2s;-webkit-appearance:none}
.fi:focus{border-color:var(--ac)}.fi::placeholder{color:var(--mt)}
.fam{font-family:'Sora',sans-serif;font-size:32px;font-weight:800;text-align:center;background:transparent;border:none;border-bottom:2px solid var(--bd);border-radius:0;padding:12px;width:100%;color:var(--tx);outline:none}
.fam:focus{border-bottom-color:var(--ac)}
.btn{width:100%;padding:14px;border:none;border-radius:var(--rs);font-size:15px;font-weight:700;font-family:inherit;cursor:pointer;transition:all .2s}
.btnp{background:var(--ag);color:#fff;box-shadow:0 4px 14px rgba(79,124,255,.3)}
.btng{background:var(--bg3);color:var(--tx);border:1px solid var(--bd)}
.btns{background:linear-gradient(135deg,#16a34a,#15803d);color:#fff}
.btnr{background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff}
.tgl{display:grid;grid-template-columns:1fr 1fr;background:var(--bg3);border-radius:var(--rs);padding:3px;gap:3px}
.tgb{padding:9px;border:none;border-radius:8px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;color:var(--mt);background:transparent}
.tgb.g{background:var(--rd);color:#fff}.tgb.a{background:var(--gn);color:#fff}
.pg{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
.pb{padding:9px 4px;border:1px solid var(--bd);border-radius:10px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;background:var(--bg3);color:var(--mt);text-align:center}
.pb.on{border-color:var(--ac);color:var(--ac);background:rgba(79,124,255,.1)}
.cs{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}
.cs::-webkit-scrollbar{display:none}
.cc{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 10px;background:var(--bg3);border:1px solid var(--bd);border-radius:11px;cursor:pointer;min-width:60px;flex-shrink:0}
.cc.on{border-color:var(--ac);background:rgba(79,124,255,.1)}
.cc-ic{font-size:19px}.cc-nm{font-size:10px;font-weight:600;color:var(--mt);white-space:nowrap}
.cc.on .cc-nm{color:var(--ac)}
.ovl{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(6px)}
.sht{background:var(--bg2);border-radius:22px 22px 0 0;padding:16px 16px calc(26px + env(safe-area-inset-bottom));width:100%;max-width:430px;max-height:92dvh;overflow-y:auto;animation:up .25s ease}
@keyframes up{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
.hdl{width:32px;height:4px;background:var(--bd2);border-radius:2px;margin:0 auto 16px}
.sttl{font-family:'Sora',sans-serif;font-size:17px;font-weight:800;margin-bottom:16px}
.flt{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;margin-bottom:9px}
.flt::-webkit-scrollbar{display:none}
.fc{padding:5px 12px;background:var(--bg2);border:1px solid var(--bd);border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;color:var(--mt2)}
.fc.on{background:rgba(79,124,255,.12);border-color:var(--ac);color:var(--ac)}
.pw{height:6px;background:rgba(255,255,255,.07);border-radius:10px;overflow:hidden;margin-top:6px}
.pb2{height:100%;border-radius:10px;transition:width .7s cubic-bezier(.4,0,.2,1)}
.pw.tk{height:9px}
.cg{display:grid;grid-template-columns:1fr 28px 1fr;gap:6px;align-items:center;margin-bottom:12px}
.cp{background:var(--bg3);border-radius:13px;padding:13px;text-align:center;border:1px solid var(--bd)}
.bc{margin-bottom:12px}
.br{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.bcl{font-size:13px;font-weight:600;display:flex;align-items:center;gap:5px}
.savh{background:linear-gradient(145deg,#0a1f10,#071209);border:1px solid rgba(34,197,94,.2);border-radius:20px;padding:20px;margin-bottom:12px}
.tbar{display:flex;align-items:flex-end;gap:4px;height:90px;padding:0 2px}
.tc{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1}
.tb{width:100%;border-radius:4px 4px 0 0;min-height:3px}
.tl{font-size:9px;color:var(--mt);font-weight:600;white-space:nowrap}
.ar{display:flex;gap:6px;margin-top:5px;margin-bottom:7px}
.ab{flex:1;padding:7px;background:var(--bg3);border:1px solid var(--bd);border-radius:8px;font-size:11px;font-weight:700;font-family:inherit;cursor:pointer;color:var(--mt2)}
.ab.del{color:var(--rd);border-color:rgba(244,63,94,.25)}
.sli{display:flex;justify-content:space-between;padding:11px 13px;background:var(--bg2);border:1px solid var(--bd);border-radius:12px;margin-bottom:6px}
.pch{flex-shrink:0;cursor:pointer;padding:9px 13px;border-radius:12px;min-width:140px}
.toast{position:fixed;top:56px;left:50%;transform:translateX(-50%);background:#1a2a1a;border:1px solid var(--gn);color:var(--gn);padding:8px 16px;border-radius:20px;font-size:12px;font-weight:700;z-index:999;animation:fio 2.5s forwards;white-space:nowrap;pointer-events:none}
@keyframes fio{0%{opacity:0;transform:translateX(-50%) translateY(-6px)}15%,75%{opacity:1;transform:translateX(-50%) translateY(0)}100%{opacity:0}}
.empty{text-align:center;padding:40px 20px;color:var(--mt)}
.empty-ic{font-size:40px;margin-bottom:8px}
.div{height:1px;background:var(--bd);margin:10px 0}
.login-wrap{max-width:430px;margin:0 auto;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:var(--bg)}
.login-card{width:100%;background:var(--bg2);border:1px solid var(--bd);border-radius:20px;padding:28px}
`

// ============================================================
// SMALL COMPONENTS
// ============================================================
function Toast({msg,onDone}:{msg:string,onDone:()=>void}) {
  useEffect(()=>{const t=setTimeout(onDone,2600);return()=>clearTimeout(t)},[])
  return <div className="toast">{msg}</div>
}
function PBadge({p}:{p:string}) { return <span className={`bdg ${p}`}>{p}</span> }
function Prog({pct,color,thick}:{pct:number,color?:string,thick?:boolean}) {
  const bg=pct>=100?'var(--rd)':pct>=80?'var(--yw)':(color||'var(--ac)')
  return <div className={`pw${thick?' tk':''}`}><div className="pb2" style={{width:`${Math.min(pct,100)}%`,background:bg}}/></div>
}
function MonthBar({months,sel,onChange}:{months:string[],sel:string,onChange:(m:string)=>void}) {
  return (
    <div className="mbar">
      <div className={`mc${sel==='all'?' on':''}`} onClick={()=>onChange('all')}>Todo</div>
      {months.map(m=><div key={m} className={`mc${sel===m?' on':''}`} onClick={()=>onChange(m)}>{fmtMonth(m)}</div>)}
    </div>
  )
}
function TrendChart({data,ck='gasto'}:{data:any[],ck?:string}) {
  const max=Math.max(...data.map(d=>d[ck]||0),1)
  const color=ck==='gasto'?'var(--rd)':ck==='ahorro'?'var(--gn)':ck==='diego'?'#7aa3ff':'#f472b6'
  return (
    <div className="tbar">
      {data.map((d,i)=>{
        const v=d[ck]||0,pct=(v/max)*100
        return (
          <div key={i} className="tc">
            <div style={{fontSize:9,color:'var(--mt2)',fontWeight:700,marginBottom:2}}>{fmtS(v)}</div>
            <div className="tb" style={{height:`${Math.max(pct,3)}%`,background:color,opacity:i===data.length-1?1:.6}}/>
            <div className="tl">{d.label}</div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// MAIN APP COMPONENT
// ============================================================
export default function FamFinance() {
  // Styles
  useEffect(()=>{
    if(document.getElementById('ff-styles')) return
    const s=document.createElement('style'); s.id='ff-styles'; s.textContent=STYLES
    document.head.appendChild(s)
  },[])

  // Auth state
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [authMsg, setAuthMsg] = useState('')
  const [householdId, setHouseholdId] = useState<string|null>(null)

  // App state
  const [tab, setTab] = useState('dashboard')
  const [entries, setEntries] = useState<Entry[]>([])
  const [cats, setCats] = useState<Category[]>([])
  const [budget, setBudget] = useState<Budget>({total_budget:6000,cat_budgets:{}})
  const [cfg, setCfg] = useState<SettleCfg>({anchor_date:'2025-03-13',interval_days:14})
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [toast, setToast] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editEntry, setEditEntry] = useState<Entry|null>(null)
  const [showSettle, setShowSettle] = useState(false)
  const [settleTarget, setSettleTarget] = useState<any>(null)
  const [selMonth, setSelMonth] = useState('all')
  const [selPeriod, setSelPeriod] = useState<any>(null)
  const months = useMemo(()=>allMonths(entries),[entries])
  const t$ = (msg:string)=>setToast(msg)

  // ── AUTH ──
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      setUser(session?.user||null)
      setLoading(false)
    })
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{
      setUser(session?.user||null)
    })
    return ()=>subscription.unsubscribe()
  },[])

  // Load household when user logs in
  useEffect(()=>{
    if(!user) return
    supabase.from('profiles').select('household_id').eq('id',user.id).single()
      .then(({data})=>{ if(data) setHouseholdId(data.household_id) })
  },[user])

  // Load all data when household is set
  useEffect(()=>{
    if(!householdId) return
    loadAll()
    // Real-time subscription
    const channel = supabase.channel('famfinance-changes')
      .on('postgres_changes',{event:'*',schema:'public',table:'entries',filter:`household_id=eq.${householdId}`},()=>loadEntries())
      .on('postgres_changes',{event:'*',schema:'public',table:'categories',filter:`household_id=eq.${householdId}`},()=>loadCats())
      .on('postgres_changes',{event:'*',schema:'public',table:'monthly_budgets',filter:`household_id=eq.${householdId}`},()=>loadBudget())
      .on('postgres_changes',{event:'*',schema:'public',table:'settlements',filter:`household_id=eq.${householdId}`},()=>loadSettlements())
      .subscribe()
    return ()=>{ supabase.removeChannel(channel) }
  },[householdId])

  async function loadAll() {
    await Promise.all([loadEntries(),loadCats(),loadBudget(),loadCfg(),loadSettlements()])
  }

  async function loadEntries() {
    const {data}=await supabase.from('entries').select('*').eq('household_id',householdId).order('entry_date',{ascending:false})
    if(data) setEntries(data as Entry[])
  }
  async function loadCats() {
    const {data}=await supabase.from('categories').select('*').eq('household_id',householdId).order('name')
    if(data) setCats(data as Category[])
  }
  async function loadBudget() {
    const {data}=await supabase.from('monthly_budgets').select('*').eq('household_id',householdId).single()
    if(data) setBudget(data as Budget)
  }
  async function loadCfg() {
    const {data}=await supabase.from('settlement_config').select('*').eq('household_id',householdId).single()
    if(data) setCfg(data as SettleCfg)
  }
  async function loadSettlements() {
    const {data}=await supabase.from('settlements').select('*').eq('household_id',householdId).order('settled_date',{ascending:false})
    if(data) setSettlements(data as Settlement[])
  }

  // ── AUTH HANDLERS ──
  const handleLogin = async () => {
    const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin}})
    if(error) setAuthMsg('Error: '+error.message)
    else setAuthMsg('✅ Revisa tu email — te enviamos un link de acceso')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null); setHouseholdId(null); setEntries([]); setCats([]); setSettlements([])
  }

  // ── ENTRY HANDLERS ──
  const handleSaveEntry = useCallback(async (entry:any, deleteId?:string)=>{
    if(deleteId) {
      await supabase.from('entries').delete().eq('id',deleteId)
      t$('🗑️ Eliminado'); return
    }
    if(entry.id && entries.find(e=>e.id===entry.id)) {
      await supabase.from('entries').update({type:entry.type,person:entry.person,amount:entry.amount,category_id:entry.category_id,note:entry.note,entry_date:entry.entry_date}).eq('id',entry.id)
    } else {
      await supabase.from('entries').insert({...entry,id:undefined,household_id:householdId,created_by:user?.id})
    }
    t$('✓ Guardado')
  },[entries,householdId,user])

  const handleDeleteEntry = useCallback(async (id:string)=>{
    await supabase.from('entries').delete().eq('id',id)
    t$('🗑️ Eliminado')
  },[])

  // ── BUDGET HANDLERS ──
  const handleSaveBudget = useCallback(async (b:Budget)=>{
    await supabase.from('monthly_budgets').update({total_budget:b.total_budget,cat_budgets:b.cat_budgets}).eq('household_id',householdId)
    setBudget(b); t$('✓ Presupuesto guardado')
  },[householdId])

  // ── CATEGORY HANDLERS ──
  const handleSaveCat = useCallback(async (cat:any)=>{
    if(cat.id && cats.find(c=>c.id===cat.id)) {
      await supabase.from('categories').update({name:cat.name,icon:cat.icon,color:cat.color}).eq('id',cat.id)
    } else {
      await supabase.from('categories').insert({...cat,id:undefined,household_id:householdId,is_default:false})
    }
    t$('✓ Categoría guardada')
  },[cats,householdId])

  const handleDeleteCat = useCallback(async (id:string)=>{
    await supabase.from('categories').delete().eq('id',id)
    t$('🗑️ Categoría eliminada')
  },[])

  // ── SETTLEMENT HANDLERS ──
  const handleSettle = useCallback(async (s:any)=>{
    await supabase.from('settlements').insert({
      household_id:householdId,
      period_start:s.period.start, period_end:s.period.end,
      period_label:s.period.label, period_key:s.period.key,
      total:s.settle.total, share:s.settle.share,
      diego_paid:s.settle.dPaid, kelly_paid:s.settle.kPaid,
      owes_from:s.settle.owes?.from||null, owes_to:s.settle.owes?.to||null, owes_amount:s.settle.owes?.amount||null,
      settled_date:todayStr()
    })
    t$('✓ Periodo liquidado')
  },[householdId])

  const handleDeleteSettlement = useCallback(async (id:string)=>{
    await supabase.from('settlements').delete().eq('id',id)
  },[])

  // ── CFG HANDLER ──
  const handleSaveCfg = useCallback(async (c:SettleCfg)=>{
    await supabase.from('settlement_config').update({anchor_date:c.anchor_date,interval_days:c.interval_days}).eq('household_id',householdId)
    setCfg(c); t$('✓ Configuración guardada')
  },[householdId])

  const period = useMemo(()=>getCurrentPeriod(cfg.anchor_date,cfg.interval_days),[cfg])
  const activePeriod = settleTarget||period
  const totalNet = useMemo(()=>{
    const sv=entries.filter(e=>e.type==='ahorro').reduce((s,e)=>s+e.amount,0)
    const rt=entries.filter(e=>e.type==='retiro').reduce((s,e)=>s+e.amount,0)
    return sv-rt
  },[entries])

  const LEFT  = [{id:'dashboard',icon:'📊',label:'Inicio'},{id:'trends',icon:'📈',label:'Trends'},{id:'liquidar',icon:'⚖️',label:'Liquidar'}]
  const RIGHT = [{id:'ahorros',icon:'💰',label:'Ahorros'},{id:'historial',icon:'📋',label:'Historial'},{id:'config',icon:'⚙️',label:'Config'}]
  const TITLES:any = {
    dashboard:{t:'FamFinance',s:new Date().toLocaleDateString('es-CO',{month:'long',year:'numeric'})},
    trends:{t:'Tendencias',s:'análisis mensual'},
    liquidar:{t:'Liquidar',s:period.label},
    ahorros:{t:'Ahorros',s:`Saldo: ${fmt(totalNet)}`},
    historial:{t:'Historial',s:`${entries.filter(e=>e.type!=='retiro').length} movimientos`},
    config:{t:'Configuración',s:'Presupuesto y categorías'},
  }
  const sp = {months, sel:selMonth, setSel:setSelMonth}

  // ── LOGIN SCREEN ──
  if(loading) return <div style={{background:'#0b0d14',height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#4f7cff',fontFamily:'sans-serif'}}>Cargando...</div>

  if(!user) return (
    <div className="login-wrap">
      <div className="login-card">
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontSize:48,marginBottom:12}}>💎</div>
          <div style={{fontFamily:'Sora,sans-serif',fontSize:24,fontWeight:800}}>FamFinance</div>
          <div style={{fontSize:13,color:'var(--mt)',marginTop:4}}>Control financiero de Diego & Kelly</div>
        </div>
        {authMsg ? (
          <div style={{background:'rgba(34,197,94,.1)',border:'1px solid rgba(34,197,94,.3)',borderRadius:12,padding:14,textAlign:'center',fontSize:13,color:'var(--gn)'}}>{authMsg}</div>
        ) : (
          <>
            <div className="fg">
              <label className="fl">Tu email</label>
              <input className="fi" type="email" placeholder="diego@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
            </div>
            <button className="btn btnp" onClick={handleLogin}>Entrar con Magic Link</button>
            <div style={{fontSize:11,color:'var(--mt)',textAlign:'center',marginTop:12}}>Te enviamos un link a tu email — sin contraseña</div>
          </>
        )}
      </div>
    </div>
  )

  if(!householdId) return (
    <div className="login-wrap">
      <div style={{textAlign:'center',color:'var(--mt)',fontFamily:'sans-serif'}}>
        <div style={{fontSize:32,marginBottom:12}}>⚙️</div>
        <div style={{fontSize:14}}>Configurando tu cuenta...</div>
        <div style={{fontSize:12,marginTop:8}}>Si esto demora, contacta al administrador.</div>
        <button style={{marginTop:16,padding:'8px 16px',background:'var(--bg3)',border:'1px solid var(--bd)',borderRadius:8,color:'var(--mt)',cursor:'pointer',fontFamily:'inherit'}} onClick={handleLogout}>Cerrar sesión</button>
      </div>
    </div>
  )

  // ── MAIN APP ──
  return (
    <div className="app">
      <div className="hdr">
        <div>
          <div className="hdr-t">{TITLES[tab].t}</div>
          <div className="hdr-s">{TITLES[tab].s}</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:38,height:38,background:'var(--ag)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17}}>💎</div>
        </div>
      </div>

      <div className="body">
        {tab==='dashboard'&&<Dashboard entries={entries} budget={budget} cats={cats} settlements={settlements} cfg={cfg} onOpenSettle={()=>{setSettleTarget(period);setShowSettle(true)}} {...sp}/>}
        {tab==='trends'   &&<Trends entries={entries} cats={cats} budget={budget} {...sp}/>}
        {tab==='liquidar' &&<Liquidaciones entries={entries} settlements={settlements} cfg={cfg} onSaveCfg={handleSaveCfg} onOpenSettle={(p:any)=>{setSettleTarget(p);setShowSettle(true)}} onDeleteSettlement={handleDeleteSettlement}/>}
        {tab==='ahorros'  &&<Savings entries={entries} cats={cats} onSaveEntry={handleSaveEntry} {...sp}/>}
        {tab==='historial'&&<HistoryTab entries={entries} cats={cats} onEdit={setEditEntry} onDelete={handleDeleteEntry} {...sp}/>}
        {tab==='config'   &&<ConfigTab entries={entries} budget={budget} onSaveBudget={handleSaveBudget} cats={cats} onSaveCat={handleSaveCat} onDeleteCat={handleDeleteCat} onLogout={handleLogout} {...sp}/>}
      </div>

      <div className="nav">
        {LEFT.map(t=>(
          <div key={t.id} className={`ni${tab===t.id?' on':''}`} onClick={()=>setTab(t.id)}>
            <span className="ni-ic">{t.icon}</span><span className="ni-lb">{t.label}</span>
          </div>
        ))}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',flex:'0 0 56px'}}>
          <div className="nav-add" onClick={()=>setShowAdd(true)}>＋</div>
        </div>
        {RIGHT.map(t=>(
          <div key={t.id} className={`ni${tab===t.id?' on':''}`} onClick={()=>setTab(t.id)}>
            <span className="ni-ic">{t.icon}</span><span className="ni-lb">{t.label}</span>
          </div>
        ))}
      </div>

      {showAdd    && <EntrySheet onClose={()=>setShowAdd(false)} onSave={handleSaveEntry} cats={cats}/>}
      {editEntry  && <EntrySheet entry={editEntry} onClose={()=>setEditEntry(null)} onSave={handleSaveEntry} cats={cats}/>}
      {showSettle && <SettleSheet entries={entries} period={activePeriod} onClose={()=>{setShowSettle(false);setSettleTarget(null)}} onSettle={handleSettle}/>}
      {toast      && <Toast msg={toast} onDone={()=>setToast('')}/>}
    </div>
  )
}

// ============================================================
// ENTRY SHEET
// ============================================================
function EntrySheet({entry,onClose,onSave,cats}:{entry?:Entry,onClose:()=>void,onSave:(e:any)=>void,cats:Category[]}) {
  const isEdit=!!entry?.id
  const [type,setType]=useState(entry?.type||'gasto')
  const [person,setPerson]=useState(entry?.person||'Diego')
  const [amount,setAmount]=useState(entry?.amount?String(entry.amount):'')
  const [catId,setCatId]=useState(entry?.category_id||'')
  const [note,setNote]=useState(entry?.note||'')
  const [date,setDate]=useState(entry?.entry_date||todayStr())
  const save=()=>{
    const n=parseFloat(amount)
    if(!n||n<=0||!catId) return
    onSave({...(entry||{}),id:entry?.id||undefined,type,person,amount:n,category_id:catId,note,entry_date:date})
    onClose()
  }
  return (
    <div className="ovl" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="sht">
        <div className="hdl"/>
        <div className="sttl">{isEdit?'Editar':'Nuevo'} Movimiento</div>
        <div className="fg"><div className="tgl">
          <button className={`tgb${type==='gasto'?' g':''}`} onClick={()=>setType('gasto')}>💸 Gasto</button>
          <button className={`tgb${type==='ahorro'?' a':''}`} onClick={()=>setType('ahorro')}>💰 Ahorro</button>
        </div></div>
        <div className="fg" style={{textAlign:'center'}}>
          <label className="fl">Valor</label>
          <div style={{position:'relative'}}>
            <span style={{position:'absolute',left:'calc(50% - 55px)',top:16,fontSize:19,color:'var(--mt)'}}>$</span>
            <input className="fam" type="number" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal"/>
          </div>
        </div>
        <div className="fg">
          <label className="fl">Persona</label>
          <div className="pg">
            {['Diego','Kelly','Compartido'].map(p=><button key={p} className={`pb${person===p?' on':''}`} onClick={()=>setPerson(p)}>{p}</button>)}
          </div>
          {person==='Compartido'&&<div style={{fontSize:11,color:'var(--mt)',marginTop:6,padding:'6px 10px',background:'rgba(124,92,252,.08)',borderRadius:8,border:'1px solid rgba(124,92,252,.15)'}}>⚡ Se divide 50/50 en la liquidación</div>}
        </div>
        <div className="fg">
          <label className="fl">Categoría</label>
          <div className="cs">
            {cats.map(c=><div key={c.id} className={`cc${catId===c.id?' on':''}`} onClick={()=>setCatId(c.id)}><span className="cc-ic">{c.icon}</span><span className="cc-nm">{c.name}</span></div>)}
          </div>
        </div>
        <div className="fg"><label className="fl">Fecha</label><input className="fi" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
        <div className="fg"><label className="fl">Nota (opcional)</label><input className="fi" type="text" placeholder="Agrega una nota..." value={note} onChange={e=>setNote(e.target.value)}/></div>
        <button className="btn btnp" onClick={save}>Guardar</button>
        {isEdit&&<button className="btn btng" style={{marginTop:7}} onClick={onClose}>Cancelar</button>}
      </div>
    </div>
  )
}

// ============================================================
// SETTLE SHEET
// ============================================================
function SettleSheet({entries,period,onClose,onSettle}:{entries:Entry[],period:any,onClose:()=>void,onSettle:(s:any)=>void}) {
  const gastos=getPeriodEntries(entries,period)
  const s=calcSettlement(gastos)
  return (
    <div className="ovl" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="sht">
        <div className="hdl"/>
        <div className="sttl">Liquidar Periodo</div>
        <div style={{fontSize:12,color:'var(--mt2)',marginBottom:14}}>{period.label}</div>
        <div className="card" style={{marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}><span style={{fontSize:13,color:'var(--mt)'}}>Total</span><span style={{fontSize:16,fontWeight:800,fontFamily:'Sora'}}>{fmt(s.total)}</span></div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span style={{fontSize:13,color:'var(--mt)'}}>Corresponde a cada uno</span><span style={{fontSize:14,fontWeight:700}}>{fmt(s.share)}</span></div>
          <div className="div"/>
          {[{l:'Diego pagó',paid:s.dPaid,bal:s.dBal},{l:'Kelly pagó',paid:s.kPaid,bal:s.kBal}].map(r=>(
            <div key={r.l} style={{display:'flex',justifyContent:'space-between',marginBottom:7}}>
              <div><div style={{fontSize:13,fontWeight:600}}>{r.l}</div><div style={{fontSize:11,color:r.bal>0?'var(--gn)':r.bal<0?'var(--rd)':'var(--mt)'}}>{r.bal>0?`le deben ${fmt(r.bal)}`:r.bal<0?`debe ${fmt(Math.abs(r.bal))}`:'cuadrado ✓'}</div></div>
              <span style={{fontSize:15,fontWeight:800,fontFamily:'Sora'}}>{fmt(r.paid)}</span>
            </div>
          ))}
        </div>
        {s.owes?(
          <div style={{background:'rgba(251,191,36,.08)',border:'1px solid rgba(251,191,36,.25)',borderRadius:13,padding:14,marginBottom:12,textAlign:'center'}}>
            <div style={{fontSize:11,color:'var(--yw)',fontWeight:800,textTransform:'uppercase',marginBottom:7}}>Transferencia necesaria</div>
            <div style={{fontFamily:'Sora',fontSize:19,fontWeight:800,marginBottom:4}}><PBadge p={s.owes.from}/> <span style={{color:'var(--mt)',margin:'0 6px'}}>→</span> <PBadge p={s.owes.to}/></div>
            <div style={{fontFamily:'Sora',fontSize:26,fontWeight:800,color:'var(--yw)'}}>{fmt(s.owes.amount)}</div>
          </div>
        ):(
          <div style={{background:'rgba(34,197,94,.08)',border:'1px solid rgba(34,197,94,.2)',borderRadius:13,padding:14,marginBottom:12,textAlign:'center'}}>
            <div style={{fontSize:22}}>✅</div><div style={{fontFamily:'Sora',fontSize:15,fontWeight:700,marginTop:5}}>¡Están cuadrados!</div>
          </div>
        )}
        <button className="btn btns" style={{marginTop:14}} onClick={()=>{onSettle({period,settle:s});onClose()}}>✓ Confirmar Liquidación</button>
        <button className="btn btng" style={{marginTop:7}} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({entries,budget,cats,settlements,cfg,onOpenSettle,months,sel,setSel}:any) {
  const period=useMemo(()=>getCurrentPeriod(cfg.anchor_date,cfg.interval_days),[cfg])
  const isSettled=settlements.some((s:any)=>s.period_key===period.key)
  const settle=useMemo(()=>calcSettlement(getPeriodEntries(entries,period)),[entries,cfg])
  const mE=sel==='all'?entries:monthOf(entries,sel)
  const gastos=mE.filter((e:Entry)=>e.type==='gasto')
  const ahorros=mE.filter((e:Entry)=>e.type==='ahorro')
  const tG=gastos.reduce((s:number,e:Entry)=>s+e.amount,0)
  const tA=ahorros.reduce((s:number,e:Entry)=>s+e.amount,0)
  const avail=budget.total_budget-tG
  const bPct=budget.total_budget>0?(tG/budget.total_budget)*100:0
  const label=sel==='all'?'todos los meses':fmtMonth(sel)
  const byP=['Diego','Kelly'].map(p=>({p,g:gastos.reduce((s:number,e:Entry)=>e.person===p?s+e.amount:e.person==='Compartido'?s+e.amount/2:s,0),a:ahorros.filter((e:Entry)=>e.person===p).reduce((s:number,e:Entry)=>s+e.amount,0)}))
  const topCats=cats.map((c:Category)=>({...c,total:gastos.filter((e:Entry)=>e.category_id===c.id).reduce((s:number,e:Entry)=>s+e.amount,0),bud:budget.cat_budgets[c.id]||0})).filter((c:any)=>c.total>0).sort((a:any,b:any)=>b.total-a.total).slice(0,5)
  return (
    <div>
      <MonthBar months={months} sel={sel} onChange={setSel}/>
      <div className={`sc ${isSettled?'set':settle.owes?'owe':'bal'}`}>
        <div className={`sbdg ${isSettled?'dn':settle.owes?'pe':'ok'}`}>{isSettled?'✓ Liquidado':settle.owes?'⚡ Pendiente':'✓ Cuadrados'}</div>
        <div className="ss">{isSettled?'Periodo cerrado':settle.owes?`${settle.owes.from} debe ${fmt(settle.owes.amount)}`:'¡Están al día!'}</div>
        <div className="su">{isSettled?'Siguiente periodo activo':settle.owes?`a ${settle.owes.to} · ${period.label}`:`${period.label} · ${fmt(settle.total)} en gastos`}</div>
        {!isSettled&&<button onClick={onOpenSettle} style={{marginTop:12,padding:'8px 16px',background:'rgba(255,255,255,.07)',border:'1px solid var(--bd2)',borderRadius:9,color:'var(--tx)',fontSize:12,fontWeight:700,fontFamily:'inherit',cursor:'pointer'}}>Ver detalle y liquidar →</button>}
      </div>
      <div className="hero">
        <div className="hl">{label}</div>
        <div className="ha" style={{color:avail<0?'var(--rd)':'var(--tx)'}}>{fmt(avail)}</div>
        <div style={{fontSize:11,color:'var(--mt)',marginTop:3}}>disponible de {fmt(budget.total_budget)}</div>
        <Prog pct={bPct} thick/>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:5,fontSize:11,color:'var(--mt)'}}>
          <span>Gastado {fmt(tG)}</span>
          <span style={{color:bPct>=100?'var(--rd)':bPct>=80?'var(--yw)':'var(--mt)'}}>{bPct>=100?'🔴 Límite':bPct>=80?'⚠️ Cuidado':`${bPct.toFixed(0)}%`}</span>
        </div>
        <div className="hg">
          <div className="hs"><div className="hs-l">💸 Gastado</div><div className="hs-v" style={{color:'var(--rd)'}}>{fmt(tG)}</div></div>
          <div className="hs"><div className="hs-l">💰 Ahorrado</div><div className="hs-v" style={{color:'var(--gn)'}}>{fmt(tA)}</div></div>
        </div>
      </div>
      <div className="sec"><span className="sec-t">Diego vs Kelly</span><span style={{fontSize:11,color:'var(--mt)'}}>{label}</span></div>
      <div className="cg">
        {byP.map(x=><div key={x.p} className="cp"><div style={{fontSize:10,color:'var(--mt)',fontWeight:700,textTransform:'uppercase',marginBottom:5}}>{x.p}</div><div style={{fontFamily:'Sora',fontSize:20,fontWeight:800,color:'var(--rd)'}}>{fmt(x.g)}</div><div style={{fontSize:11,color:'var(--mt)',marginTop:2}}>gastos</div><div style={{fontFamily:'Sora',fontSize:15,fontWeight:800,color:'var(--gn)',marginTop:6}}>{fmt(x.a)}</div><div style={{fontSize:11,color:'var(--mt)',marginTop:2}}>ahorros</div></div>)}
        <div style={{textAlign:'center',fontSize:12,fontWeight:700,color:'var(--mt)'}}>VS</div>
      </div>
      {topCats.length>0&&<><div className="sec"><span className="sec-t">Top Categorías</span></div><div className="card">{topCats.map((c:any)=>{const pct=c.bud>0?(c.total/c.bud)*100:0;return(<div key={c.id} className="bc"><div className="br"><span className="bcl"><span>{c.icon}</span>{c.name}</span><span style={{fontSize:12,color:'var(--mt2)'}}>{fmt(c.total)}{c.bud>0?` / ${fmt(c.bud)}`:''}</span></div>{c.bud>0&&<Prog pct={pct} color={c.color}/>}</div>)})}</div></>}
      <div className="sec"><span className="sec-t">Ahorros</span></div>
      <div className="card" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:7,textAlign:'center'}}>
        {['Diego','Kelly','Compartido'].map(p=>{const t=ahorros.filter((e:Entry)=>e.person===p).reduce((s:number,e:Entry)=>s+e.amount,0);return <div key={p}><PBadge p={p}/><div style={{fontFamily:'Sora',fontSize:16,fontWeight:800,color:'var(--gn)',marginTop:5}}>{fmt(t)}</div></div>})}
      </div>
    </div>
  )
}

// ============================================================
// TRENDS
// ============================================================
function Trends({entries,cats,budget,months,sel,setSel}:any) {
  const [view,setView]=useState('gastos')
  const series=useMemo(()=>[...months].slice(0,6).reverse().map((m:string)=>{const me=monthOf(entries,m);const g=me.filter((e:Entry)=>e.type==='gasto');const a=me.filter((e:Entry)=>e.type==='ahorro');return{month:m,label:fmtMonth(m),gasto:g.reduce((s:number,e:Entry)=>s+e.amount,0),ahorro:a.reduce((s:number,e:Entry)=>s+e.amount,0),diego:g.reduce((s:number,e:Entry)=>e.person==='Compartido'?s+e.amount/2:e.person==='Diego'?s+e.amount:s,0),kelly:g.reduce((s:number,e:Entry)=>e.person==='Compartido'?s+e.amount/2:e.person==='Kelly'?s+e.amount:s,0)}}),[entries,months])
  const mE=sel==='all'?entries:monthOf(entries,sel)
  const gastos=mE.filter((e:Entry)=>e.type==='gasto')
  const tG=gastos.reduce((s:number,e:Entry)=>s+e.amount,0)
  const bPct=budget.total_budget>0?(tG/budget.total_budget)*100:0
  const catData=cats.map((c:Category)=>({...c,total:gastos.filter((e:Entry)=>e.category_id===c.id).reduce((s:number,e:Entry)=>s+e.amount,0),bud:budget.cat_budgets[c.id]||0})).filter((c:any)=>c.total>0||c.bud>0).sort((a:any,b:any)=>b.total-a.total)
  const cMax=Math.max(...catData.map((c:any)=>Math.max(c.total,c.bud)),1)
  const avg=(k:string)=>series.length>0?series.reduce((s:number,d:any)=>s+(d[k]||0),0)/series.length:0
  const last=series[series.length-1];const prev=series[series.length-2]
  const dPct=prev&&prev.gasto>0?((last?.gasto-prev.gasto)/prev.gasto*100):0
  return (
    <div>
      <MonthBar months={months} sel={sel} onChange={setSel}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginBottom:12}}>
        <div className="csm"><div style={{fontSize:11,color:'var(--mt)',marginBottom:4}}>Gasto promedio/mes</div><div style={{fontFamily:'Sora',fontSize:20,fontWeight:800,color:'var(--rd)'}}>{fmt(avg('gasto'))}</div>{prev&&<div style={{fontSize:11,marginTop:3,color:dPct>0?'var(--rd)':'var(--gn)'}}>{dPct>0?'↑':'↓'} {Math.abs(dPct).toFixed(0)}% vs anterior</div>}</div>
        <div className="csm"><div style={{fontSize:11,color:'var(--mt)',marginBottom:4}}>Ahorro promedio/mes</div><div style={{fontFamily:'Sora',fontSize:20,fontWeight:800,color:'var(--gn)'}}>{fmt(avg('ahorro'))}</div><div style={{fontSize:11,color:'var(--mt)',marginTop:3}}>{series.length} meses</div></div>
      </div>
      <div className="card">
        <div style={{display:'flex',gap:4,marginBottom:14}}>
          {[['gastos','💸 Gastos'],['ahorros','💰 Ahorros'],['personas','👤 Personas']].map(([k,l])=><button key={k} onClick={()=>setView(k)} style={{flex:1,padding:'7px 4px',border:view===k?'1px solid var(--ac)':'1px solid var(--bd)',borderRadius:9,background:view===k?'rgba(79,124,255,.12)':'var(--bg3)',color:view===k?'var(--ac)':'var(--mt)',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer'}}>{l}</button>)}
        </div>
        <div style={{fontSize:11,color:'var(--mt)',marginBottom:8,fontWeight:600,textTransform:'uppercase'}}>Últimos {series.length} meses</div>
        {view==='gastos'&&<TrendChart data={series} ck="gasto"/>}
        {view==='ahorros'&&<TrendChart data={series} ck="ahorro"/>}
        {view==='personas'&&<div><div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><div style={{width:10,height:10,borderRadius:2,background:'#7aa3ff'}}/><span style={{fontSize:11,color:'var(--mt2)',fontWeight:600}}>Diego</span></div><TrendChart data={series} ck="diego"/><div style={{display:'flex',alignItems:'center',gap:6,margin:'14px 0 8px'}}><div style={{width:10,height:10,borderRadius:2,background:'#f472b6'}}/><span style={{fontSize:11,color:'var(--mt2)',fontWeight:600}}>Kelly</span></div><TrendChart data={series} ck="kelly"/></div>}
      </div>
      <div className="sec"><span className="sec-t">Resumen por Mes</span></div>
      <div className="card">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:4,marginBottom:9,paddingBottom:8,borderBottom:'1px solid var(--bd)'}}>
          {['Mes','Gastos','Ahorros','Neto'].map(h=><div key={h} style={{fontSize:10,fontWeight:800,color:'var(--mt)',textTransform:'uppercase'}}>{h}</div>)}
        </div>
        {[...series].reverse().map((d:any)=><div key={d.month} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:4,marginBottom:8}}><div style={{fontSize:12,fontWeight:700}}>{d.label}</div><div style={{fontSize:12,fontWeight:700,color:'var(--rd)'}}>{fmtS(d.gasto)}</div><div style={{fontSize:12,fontWeight:700,color:'var(--gn)'}}>{fmtS(d.ahorro)}</div><div style={{fontSize:12,fontWeight:700,color:d.ahorro>d.gasto?'var(--gn)':'var(--mt2)'}}>{fmtS(d.ahorro-d.gasto)}</div></div>)}
      </div>
      <div className="sec"><span className="sec-t">Gasto vs Presupuesto</span><span style={{fontSize:11,color:'var(--mt)'}}>{sel==='all'?'todo':fmtMonth(sel)}</span></div>
      <div className="card" style={{marginBottom:10}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><span style={{fontSize:13,fontWeight:700}}>Total del mes</span><span style={{fontSize:12,color:'var(--mt2)'}}>{fmt(tG)} / {fmt(budget.total_budget)}</span></div>
        <Prog pct={bPct} thick/>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:5,fontSize:11}}><span style={{color:'var(--mt)'}}>Disponible: {fmt(budget.total_budget-tG)}</span><span style={{color:bPct>=100?'var(--rd)':bPct>=80?'var(--yw)':'var(--gn)',fontWeight:700}}>{bPct>=100?'🔴 Superado':bPct>=80?`⚠️ ${bPct.toFixed(0)}%`:`✓ ${bPct.toFixed(0)}%`}</span></div>
      </div>
      {catData.map((c:any)=>{const pct=c.bud>0?(c.total/c.bud)*100:0;return(<div key={c.id} className="card" style={{marginBottom:8}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7}}><span style={{fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:18}}>{c.icon}</span>{c.name}</span><div style={{textAlign:'right'}}><div style={{fontSize:13,fontWeight:800,color:pct>=100?'var(--rd)':pct>=80?'var(--yw)':'var(--tx)'}}>{fmt(c.total)}</div>{c.bud>0&&<div style={{fontSize:10,color:'var(--mt)'}}>de {fmt(c.bud)}</div>}</div></div><div style={{position:'relative',height:8,background:'rgba(255,255,255,.06)',borderRadius:10,overflow:'hidden'}}>{c.bud>0&&<div style={{position:'absolute',left:`${Math.min((c.bud/cMax)*100,100)}%`,top:0,width:2,height:'100%',background:'rgba(255,255,255,.25)',zIndex:2}}/>}<div style={{height:'100%',width:`${Math.min((c.total/cMax)*100,100)}%`,background:pct>=100?'var(--rd)':pct>=80?'var(--yw)':c.color,borderRadius:10}}/></div>{c.bud>0&&<div style={{display:'flex',justifyContent:'space-between',marginTop:4,fontSize:10,color:'var(--mt)'}}><span>{pct.toFixed(0)}% usado</span><span style={{color:c.bud>=c.total?'var(--gn)':'var(--rd)'}}>{c.bud>=c.total?`${fmt(c.bud-c.total)} disponible`:`${fmt(c.total-c.bud)} excedido`}</span></div>}</div>);})}
    </div>
  )
}

// ============================================================
// LIQUIDACIONES
// ============================================================
function Liquidaciones({entries,settlements,cfg,onSaveCfg,onOpenSettle,onDeleteSettlement}:any) {
  const [showCfgSheet,setShowCfgSheet]=useState(false)
  const today=todayStr()
  const allPeriods=useMemo(()=>buildPeriods(cfg.anchor_date,cfg.interval_days),[cfg])
  const currentP=useMemo(()=>getCurrentPeriod(cfg.anchor_date,cfg.interval_days),[cfg])
  const relevant=useMemo(()=>allPeriods.filter((p:any)=>{const hasData=entries.some((e:Entry)=>e.type==='gasto'&&e.entry_date>=p.start&&e.entry_date<=p.end);const isCurrent=p.key===currentP.key;const isNear=p.start<=addDays(today,cfg.interval_days*2)&&p.start>today;return hasData||isCurrent||isNear}),[allPeriods,entries,currentP,cfg,today])
  const [selKey,setSelKey]=useState(()=>currentP.key)
  useEffect(()=>setSelKey(getCurrentPeriod(cfg.anchor_date,cfg.interval_days).key),[cfg])
  const selPeriod=allPeriods.find((p:any)=>p.key===selKey)||currentP
  const isSettled=settlements.some((s:any)=>s.period_key===selPeriod.key)
  const pGastos=getPeriodEntries(entries,selPeriod)
  const settle=useMemo(()=>calcSettlement(pGastos),[entries,selPeriod])
  const isFuture=selPeriod.start>today
  const nextDate=addDays(currentP.end,1)
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div><div style={{fontSize:13,fontWeight:700}}>Cada {cfg.interval_days} días</div><div style={{fontSize:11,color:'var(--mt)'}}>Próxima: {fmtDate(nextDate)}</div></div>
        <button onClick={()=>setShowCfgSheet(true)} style={{padding:'7px 13px',background:'var(--bg3)',border:'1px solid var(--bd2)',borderRadius:9,color:'var(--mt2)',fontSize:12,fontWeight:700,fontFamily:'inherit',cursor:'pointer'}}>⚙️ Configurar</button>
      </div>
      <div className="sec"><span className="sec-t">Seleccionar Periodo</span></div>
      <div style={{display:'flex',gap:7,overflowX:'auto',paddingBottom:8,marginBottom:14}}>
        {[...relevant].reverse().map((p:any)=>{const pSett=settlements.some((s:any)=>s.period_key===p.key);const pCurr=p.key===currentP.key;const pSettle=calcSettlement(getPeriodEntries(entries,p));const sel=p.key===selKey;return(<div key={p.key} className="pch" onClick={()=>setSelKey(p.key)} style={{background:sel?'rgba(79,124,255,.15)':'var(--bg2)',border:sel?'1px solid var(--ac)':'1px solid var(--bd)'}}><div style={{display:'flex',alignItems:'center',gap:5,marginBottom:4}}><div style={{width:7,height:7,borderRadius:'50%',background:pSett?'var(--gn)':pCurr?'var(--yw)':'var(--mt)'}}/><span style={{fontSize:10,fontWeight:700,color:pSett?'var(--gn)':pCurr?'var(--yw)':'var(--mt)',textTransform:'uppercase'}}>{pSett?'Liquidado':pCurr?'Actual':'Pasado'}</span></div><div style={{fontSize:12,fontWeight:700,color:sel?'var(--ac)':'var(--tx)'}}>{p.label}</div>{!pSett&&pSettle.total>0&&<div style={{fontSize:11,marginTop:3,color:pSettle.owes?'var(--yw)':'var(--gn)'}}>{pSettle.owes?`${pSettle.owes.from} debe ${fmt(pSettle.owes.amount)}`:'Cuadrados ✓'}</div>}</div>)})}
      </div>
      <div className="sec"><span className="sec-t">Detalle</span><span style={{fontSize:11,color:'var(--mt)'}}>{selPeriod.label}</span></div>
      {isFuture?(<div style={{background:'var(--bg2)',border:'1px solid var(--bd)',borderRadius:14,padding:20,textAlign:'center'}}><div style={{fontSize:28,marginBottom:8}}>📅</div><div style={{fontFamily:'Sora',fontSize:14,fontWeight:700}}>Periodo futuro</div></div>
      ):isSettled?(<div><div style={{background:'rgba(34,197,94,.06)',border:'1px solid rgba(34,197,94,.2)',borderRadius:14,padding:16,marginBottom:12,textAlign:'center'}}><div style={{fontSize:26,marginBottom:5}}>✅</div><div style={{fontFamily:'Sora',fontSize:14,fontWeight:700}}>Periodo liquidado</div></div><PeriodBreakdown gastos={pGastos} settle={settle}/></div>
      ):(<div><div className={`sc ${settle.owes?'owe':'bal'}`} style={{marginBottom:12}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}><div><div className={`sbdg ${settle.owes?'pe':'ok'}`}>{settle.owes?'⚡ Pendiente':'✓ Cuadrados'}</div><div className="ss" style={{fontSize:17}}>{settle.owes?`${settle.owes.from} debe ${fmt(settle.owes.amount)}`:'¡Están al día!'}</div>{settle.owes&&<div className="su">→ a {settle.owes.to}</div>}</div><div style={{textAlign:'right'}}><div style={{fontSize:10,color:'var(--mt)'}}>Total</div><div style={{fontFamily:'Sora',fontSize:19,fontWeight:800}}>{fmt(settle.total)}</div></div></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginTop:12}}>{[{p:'Diego',paid:settle.dPaid,bal:settle.dBal},{p:'Kelly',paid:settle.kPaid,bal:settle.kBal}].map(r=>(<div key={r.p} style={{background:'rgba(255,255,255,.04)',borderRadius:10,padding:10}}><div style={{fontSize:11,color:'var(--mt)',marginBottom:3}}><PBadge p={r.p}/></div><div style={{fontFamily:'Sora',fontSize:15,fontWeight:800}}>{fmt(r.paid)}</div><div style={{fontSize:10,marginTop:2,color:r.bal>0?'var(--gn)':r.bal<0?'var(--rd)':'var(--mt)'}}>{r.bal>0?`le deben ${fmt(r.bal)}`:r.bal<0?`debe ${fmt(Math.abs(r.bal))}`:'cuadrado ✓'}</div></div>))}</div>{settle.total>0&&<button onClick={()=>onOpenSettle(selPeriod)} className="btn btns" style={{marginTop:12}}>Liquidar Periodo →</button>}</div><PeriodBreakdown gastos={pGastos} settle={settle}/></div>)}
      <div className="sec"><span className="sec-t">Historial</span></div>
      {settlements.length===0&&<div className="empty"><div className="empty-ic">📋</div><div>Sin liquidaciones aún</div></div>}
      {[...settlements].map((s:Settlement)=>(<div key={s.id} className="sli"><div><div style={{fontSize:13,fontWeight:700}}>{s.period_label}</div><div style={{fontSize:11,color:'var(--mt)',marginTop:2}}>{s.owes_from?`${s.owes_from} → ${s.owes_to} · ${fmt(s.owes_amount||0)}`:'Sin transferencia'}</div><div style={{fontSize:10,color:'var(--mt)',marginTop:2}}>Liquidado el {fmtDate(s.settled_date)}</div></div><div style={{textAlign:'right'}}><div style={{fontSize:14,fontWeight:800,color:'var(--ac)'}}>{fmt(s.total)}</div><button onClick={()=>onDeleteSettlement(s.id)} style={{fontSize:10,color:'var(--rd)',background:'none',border:'none',cursor:'pointer',marginTop:5,display:'block'}}>eliminar</button></div></div>))}
      {showCfgSheet&&<SettleCfgSheet cfg={cfg} onSave={onSaveCfg} onClose={()=>setShowCfgSheet(false)}/>}
    </div>
  )
}

function PeriodBreakdown({gastos,settle}:{gastos:Entry[],settle:any}) {
  if(gastos.length===0) return <div className="empty"><div className="empty-ic">🧾</div><div>Sin gastos en este periodo</div></div>
  return (<div className="card"><div style={{fontSize:11,color:'var(--mt)',fontWeight:700,textTransform:'uppercase',marginBottom:10}}>{gastos.length} gastos · {fmt(settle.total)}</div>{gastos.map(e=>{const cat=getCat(e.category_id,[]);const dS=e.person==='Compartido'?e.amount/2:e.person==='Diego'?e.amount:0;const kS=e.person==='Compartido'?e.amount/2:e.person==='Kelly'?e.amount:0;return(<div key={e.id} style={{display:'flex',alignItems:'center',gap:9,padding:'8px 0',borderBottom:'1px solid var(--bd)'}}><span style={{fontSize:15}}>{cat.icon}</span><div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{e.note||'Gasto'}</div><div style={{fontSize:11,color:'var(--mt)',marginTop:1,display:'flex',gap:5,flexWrap:'wrap'}}><PBadge p={e.person}/><span>· {fmtDate(e.entry_date)}</span>{e.person==='Compartido'&&<span style={{color:'var(--mt2)'}}>D:{fmt(dS)} / K:{fmt(kS)}</span>}</div></div><span style={{fontSize:12,fontWeight:700,color:'var(--rd)'}}>{fmt(e.amount)}</span></div>)})}</div>)
}

function SettleCfgSheet({cfg,onSave,onClose}:any) {
  const [anchor,setAnchor]=useState(cfg.anchor_date)
  const [interval,setInterval]=useState(cfg.interval_days)
  const next=useMemo(()=>{try{return addDays(anchor,Number(interval))}catch{return null}},[anchor,interval])
  return (<div className="ovl" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="sht"><div className="hdl"/><div className="sttl">⚙️ Configurar Liquidación</div><div className="fg"><label className="fl">Última fecha liquidada</label><input className="fi" type="date" value={anchor} onChange={e=>setAnchor(e.target.value)}/></div><div className="fg"><label className="fl">Intervalo (días)</label><input className="fi" type="number" value={interval} min={7} max={31} onChange={e=>setInterval(e.target.value)}/><div style={{fontSize:11,color:'var(--mt)',marginTop:5}}>14 = cada dos viernes · 7 = semanal · 30 = mensual</div></div>{next&&<div style={{fontSize:12,color:'var(--ac)',background:'rgba(79,124,255,.08)',borderRadius:9,padding:'8px 12px',marginBottom:14}}>📅 Próxima: <strong>{fmtDate(next)}</strong></div>}<button className="btn btnp" onClick={()=>{onSave({anchor_date:anchor,interval_days:Number(interval)});onClose()}}>Guardar</button><button className="btn btng" style={{marginTop:7}} onClick={onClose}>Cancelar</button></div></div>)
}

// ============================================================
// HISTORY TAB
// ============================================================
function HistoryTab({entries,cats,onEdit,onDelete,months,sel,setSel}:any) {
  const [fP,setFP]=useState('Todos');const [fT,setFT]=useState('Todos');const [fC,setFC]=useState('Todas');const [exp,setExp]=useState<string|null>(null)
  const filtered=useMemo(()=>entries.filter((e:Entry)=>{if(fP!=='Todos'&&e.person!==fP)return false;if(fT==='gasto'&&e.type!=='gasto')return false;if(fT==='ahorro'&&!['ahorro','retiro'].includes(e.type))return false;if(fC!=='Todas'&&e.category_id!==fC)return false;if(sel!=='all'&&!e.entry_date.startsWith(sel))return false;return true}).sort((a:Entry,b:Entry)=>b.entry_date.localeCompare(a.entry_date)),[entries,fP,fT,fC,sel])
  return (
    <div>
      <MonthBar months={months} sel={sel} onChange={setSel}/>
      <div className="flt">{['Todos','Diego','Kelly','Compartido'].map(p=><div key={p} className={`fc${fP===p?' on':''}`} onClick={()=>setFP(p)}>{p}</div>)}</div>
      <div className="flt">{[['Todos','Todos'],['gasto','💸 Gastos'],['ahorro','💰 Ahorros/Retiros']].map(([k,l])=><div key={k} className={`fc${fT===k?' on':''}`} onClick={()=>setFT(k)}>{l}</div>)}</div>
      <div className="flt"><div className={`fc${fC==='Todas'?' on':''}`} onClick={()=>setFC('Todas')}>Todas</div>{cats.map((c:Category)=><div key={c.id} className={`fc${fC===c.id?' on':''}`} onClick={()=>setFC(c.id)}>{c.icon} {c.name}</div>)}</div>
      <div style={{fontSize:12,color:'var(--mt)',marginBottom:10,fontWeight:600}}>{filtered.length} movimientos</div>
      {filtered.length===0&&<div className="empty"><div className="empty-ic">🔍</div><div>Sin movimientos</div></div>}
      {filtered.map((e:Entry)=>{const cat=getCat(e.category_id,cats);const isRet=e.type==='retiro';const open=exp===e.id;return(<div key={e.id}><div className="er" onClick={()=>setExp(open?null:e.id)}><div className="ei" style={{background:isRet?'rgba(244,63,94,.12)':cat.color+'22'}}>{cat.icon}</div><div className="en"><div className="enm">{cat.name}{isRet&&<span style={{fontSize:10,background:'rgba(244,63,94,.15)',color:'#f87171',borderRadius:5,padding:'1px 5px',fontWeight:700,marginLeft:5}}>RETIRO</span>}{e.note?` · ${e.note}`:''}</div><div className="emt"><PBadge p={e.person}/>{e.person==='Compartido'&&<span style={{fontSize:10,color:'var(--mt)'}}>50/50</span>}<span>· {fmtDate(e.entry_date)}</span></div></div><div className={`eam ${e.type}`}>{e.type==='gasto'?'-':'+'}{fmt(e.amount)}</div></div>{open&&<div className="ar">{!isRet&&<button className="ab" onClick={()=>{onEdit(e);setExp(null)}}>✏️ Editar</button>}<button className="ab del" onClick={()=>{onDelete(e.id);setExp(null)}}>🗑️ Eliminar</button></div>}</div>)})}
    </div>
  )
}

// ============================================================
// SAVINGS
// ============================================================
function Savings({entries,cats,onSaveEntry,months,sel,setSel}:any) {
  const [showW,setShowW]=useState(false);const [expId,setExpId]=useState<string|null>(null);const [onlyCat,setOnlyCat]=useState('Todas')
  const allSav=entries.filter((e:Entry)=>e.type==='ahorro');const allRet=entries.filter((e:Entry)=>e.type==='retiro')
  const net=allSav.reduce((s:number,e:Entry)=>s+e.amount,0)-allRet.reduce((s:number,e:Entry)=>s+e.amount,0)
  const mE=sel==='all'?entries:monthOf(entries,sel)
  const byP=['Diego','Kelly','Compartido'].map(p=>({p,saved:allSav.filter((e:Entry)=>e.person===p).reduce((s:number,e:Entry)=>s+e.amount,0),withdrew:allRet.filter((e:Entry)=>e.person===p).reduce((s:number,e:Entry)=>s+e.amount,0),net:allSav.filter((e:Entry)=>e.person===p).reduce((s:number,e:Entry)=>s+e.amount,0)-allRet.filter((e:Entry)=>e.person===p).reduce((s:number,e:Entry)=>s+e.amount,0)}))
  const byCat=cats.map((c:Category)=>({...c,saved:allSav.filter((e:Entry)=>e.category_id===c.id).reduce((s:number,e:Entry)=>s+e.amount,0),withdrew:allRet.filter((e:Entry)=>e.category_id===c.id).reduce((s:number,e:Entry)=>s+e.amount,0),net:allSav.filter((e:Entry)=>e.category_id===c.id).reduce((s:number,e:Entry)=>s+e.amount,0)-allRet.filter((e:Entry)=>e.category_id===c.id).reduce((s:number,e:Entry)=>s+e.amount,0)})).filter((c:any)=>c.saved>0||c.withdrew>0).sort((a:any,b:any)=>b.net-a.net)
  const cMax=Math.max(...byCat.map((c:any)=>c.saved),1)
  const activity=[...mE.filter((e:Entry)=>e.type==='ahorro'),...mE.filter((e:Entry)=>e.type==='retiro')].filter(e=>onlyCat==='Todas'||e.category_id===onlyCat).sort((a:Entry,b:Entry)=>b.entry_date.localeCompare(a.entry_date))
  return (
    <div>
      <MonthBar months={months} sel={sel} onChange={setSel}/>
      <div className="savh">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div><div className="hl">Saldo Total Ahorrado</div><div style={{fontFamily:'Sora',fontSize:34,fontWeight:800,color:net>=0?'var(--gn)':'var(--rd)',lineHeight:1}}>{fmt(net)}</div><div style={{fontSize:11,color:'var(--mt)',marginTop:4}}>{fmt(allSav.reduce((s:number,e:Entry)=>s+e.amount,0))} ahorrado · {fmt(allRet.reduce((s:number,e:Entry)=>s+e.amount,0))} retirado</div></div>
          <button onClick={()=>setShowW(true)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:'rgba(244,63,94,.12)',border:'1px solid rgba(244,63,94,.25)',borderRadius:12,padding:'10px 14px',cursor:'pointer',flexShrink:0}}><span style={{fontSize:20}}>📤</span><span style={{fontSize:10,fontWeight:700,color:'#f87171'}}>Retirar</span></button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:7,marginTop:14}}>{byP.map(x=><div key={x.p} style={{textAlign:'center',background:'rgba(255,255,255,.04)',borderRadius:10,padding:9}}><PBadge p={x.p}/><div style={{fontFamily:'Sora',fontSize:16,fontWeight:800,color:x.net>=0?'var(--gn)':'var(--rd)',marginTop:5}}>{fmt(x.net)}</div></div>)}</div>
      </div>
      <div className="sec"><span className="sec-t">Por Categoría</span><span style={{fontSize:11,color:'var(--mt)'}}>acumulado</span></div>
      {byCat.length===0&&<div className="empty"><div className="empty-ic">💰</div><div>Sin ahorros aún</div></div>}
      {byCat.map((c:any)=><div key={c.id} className="card" style={{marginBottom:8,cursor:'pointer'}} onClick={()=>setOnlyCat(onlyCat===c.id?'Todas':c.id)}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><span style={{fontSize:14,fontWeight:600,display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:20}}>{c.icon}</span>{c.name}</span><div style={{textAlign:'right'}}><div style={{fontFamily:'Sora',fontSize:16,fontWeight:800,color:c.net>=0?'var(--gn)':'var(--rd)'}}>{fmt(c.net)}</div></div></div><div style={{display:'flex',flexDirection:'column',gap:3}}>{[{lbl:'Ahorrado',v:c.saved,col:'var(--gn)'},{lbl:'Retirado',v:c.withdrew,col:'var(--rd)'}].filter(r=>r.v>0).map(r=><div key={r.lbl} style={{display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:10,color:'var(--mt)',width:50}}>{r.lbl}</span><div style={{flex:1,height:6,background:'rgba(255,255,255,.07)',borderRadius:10,overflow:'hidden'}}><div style={{height:'100%',width:`${(r.v/cMax)*100}%`,background:r.col,borderRadius:10}}/></div><span style={{fontSize:10,color:r.col,fontWeight:700,width:46,textAlign:'right'}}>{fmt(r.v)}</span></div>)}</div></div>)}
      <div className="sec"><span className="sec-t">Movimientos</span>{onlyCat!=='Todas'&&<span className="sec-a" onClick={()=>setOnlyCat('Todas')}>Ver todos ✕</span>}</div>
      <div className="flt"><div className={`fc${onlyCat==='Todas'?' on':''}`} onClick={()=>setOnlyCat('Todas')}>Todas</div>{byCat.map((c:any)=><div key={c.id} className={`fc${onlyCat===c.id?' on':''}`} onClick={()=>setOnlyCat(c.id)}>{c.icon} {c.name}</div>)}</div>
      {activity.length===0&&<div className="empty"><div className="empty-ic">🔍</div><div>Sin movimientos</div></div>}
      {activity.map((e:Entry)=>{const cat=getCat(e.category_id,cats);const isRet=e.type==='retiro';const open=expId===e.id;return(<div key={e.id}><div className="er" onClick={()=>setExpId(open?null:e.id)}><div className="ei" style={{background:isRet?'rgba(244,63,94,.12)':cat.color+'22',position:'relative'}}>{cat.icon}{isRet&&<span style={{position:'absolute',bottom:-3,right:-3,fontSize:10}}>📤</span>}</div><div className="en"><div className="enm">{cat.name}{isRet&&<span style={{fontSize:10,background:'rgba(244,63,94,.15)',color:'#f87171',borderRadius:5,padding:'1px 5px',fontWeight:700,marginLeft:5}}>RETIRO</span>}{e.note?` · ${e.note}`:''}</div><div className="emt"><PBadge p={e.person}/> · {fmtDate(e.entry_date)}</div></div><div className="eam" style={{color:isRet?'var(--rd)':'var(--gn)'}}>{isRet?'-':'+'}{fmt(e.amount)}</div></div>{open&&<div className="ar"><button className="ab del" onClick={()=>{onSaveEntry(null,e.id);setExpId(null)}}>🗑️ Eliminar</button></div>}</div>)})}
      {showW&&<WithdrawSheet cats={cats} onClose={()=>setShowW(false)} onSave={(e:any)=>{onSaveEntry(e);setShowW(false)}}/>}
    </div>
  )
}

function WithdrawSheet({cats,onClose,onSave}:any) {
  const [person,setPerson]=useState('Diego');const [amount,setAmount]=useState('');const [catId,setCatId]=useState('');const [note,setNote]=useState('');const [date,setDate]=useState(todayStr())
  const save=()=>{const n=parseFloat(amount);if(!n||n<=0||!catId)return;onSave({type:'retiro',person,amount:n,category_id:catId,note,entry_date:date});onClose()}
  return (<div className="ovl" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="sht"><div className="hdl"/><div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}><div style={{width:36,height:36,background:'rgba(244,63,94,.15)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>📤</div><div className="sttl" style={{margin:0}}>Retirar Ahorro</div></div><div style={{background:'rgba(244,63,94,.07)',border:'1px solid rgba(244,63,94,.2)',borderRadius:10,padding:'10px 13px',marginBottom:14,fontSize:12,color:'#f87171'}}>⚠️ El retiro descuenta del saldo de ahorros.</div><div className="fg" style={{textAlign:'center'}}><label className="fl">Monto</label><div style={{position:'relative'}}><span style={{position:'absolute',left:'calc(50% - 55px)',top:16,fontSize:19,color:'var(--mt)'}}>$</span><input className="fam" style={{borderBottomColor:'var(--rd)'}} type="number" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal"/></div></div><div className="fg"><label className="fl">Persona</label><div className="pg">{['Diego','Kelly','Compartido'].map(p=><button key={p} className={`pb${person===p?' on':''}`} onClick={()=>setPerson(p)}>{p}</button>)}</div></div><div className="fg"><label className="fl">Categoría</label><div className="cs">{cats.map((c:Category)=><div key={c.id} className={`cc${catId===c.id?' on':''}`} onClick={()=>setCatId(c.id)}><span className="cc-ic">{c.icon}</span><span className="cc-nm">{c.name}</span></div>)}</div></div><div className="fg"><label className="fl">Fecha</label><input className="fi" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div><div className="fg"><label className="fl">Motivo</label><input className="fi" type="text" placeholder="Emergencia, viaje..." value={note} onChange={e=>setNote(e.target.value)}/></div><button className="btn btnr" onClick={save}>📤 Confirmar Retiro</button><button className="btn btng" style={{marginTop:7}} onClick={onClose}>Cancelar</button></div></div>)
}

// ============================================================
// CONFIG TAB
// ============================================================
function ConfigTab({entries,budget,onSaveBudget,cats,onSaveCat,onDeleteCat,onLogout,months,sel,setSel}:any) {
  const [section,setSection]=useState('budget')
  const [editTotal,setEditTotal]=useState(false);const [tempTotal,setTempTotal]=useState(String(budget.total_budget))
  const [editCatId,setEditCatId]=useState<string|null>(null);const [tempCatVal,setTempCatVal]=useState('')
  const [showNewCat,setShowNewCat]=useState(false);const [editCat,setEditCat]=useState<any>(null)
  const [catName,setCatName]=useState('');const [catIcon,setCatIcon]=useState('📦');const [catColor,setCatColor]=useState('#6366f1')
  const mE=sel==='all'?entries:monthOf(entries,sel)
  const gastos=mE.filter((e:Entry)=>e.type==='gasto')
  const saveTotal=()=>{const n=parseFloat(tempTotal);if(n>0){onSaveBudget({...budget,total_budget:n});setEditTotal(false)}}
  const saveCatBudget=(id:string)=>{const n=parseFloat(tempCatVal);if(n>=0){onSaveBudget({...budget,cat_budgets:{...budget.cat_budgets,[id]:n}});setEditCatId(null)}}
  const openNewCat=()=>{setCatName('');setCatIcon('📦');setCatColor('#6366f1');setEditCat(null);setShowNewCat(true)}
  const openEditCat=(c:any)=>{setCatName(c.name);setCatIcon(c.icon);setCatColor(c.color);setEditCat(c);setShowNewCat(true)}
  const saveCat=()=>{if(!catName.trim())return;onSaveCat({...(editCat||{}),name:catName,icon:catIcon,color:catColor});setShowNewCat(false)}
  const PRESET_ICONS=['🏠','💡','🛒','🍽️','🚗','⛽','🏥','📚','🛍️','🎬','✈️','🐾','🇨🇴','💰','📦','🎯','💊','🏋️','🎁','🍺','☕','🎵','🏖️','🚌','🏦','📱','🐕','👶','🌿','🍕']
  const PRESET_COLORS=['#3b82f6','#f59e0b','#10b981','#ef4444','#8b5cf6','#f97316','#06b6d4','#6366f1','#ec4899','#14b8a6','#0ea5e9','#a78bfa','#facc15','#22c55e','#94a3b8','#e11d48']
  return (
    <div>
      <MonthBar months={months} sel={sel} onChange={setSel}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',background:'var(--bg3)',borderRadius:'var(--rs)',padding:3,gap:3,marginBottom:16}}>
        {[['budget','🎯 Presupuesto'],['cats','🏷️ Categorías']].map(([k,l])=><button key={k} onClick={()=>setSection(k)} style={{padding:'10px',border:'none',borderRadius:8,fontFamily:'inherit',fontSize:13,fontWeight:700,cursor:'pointer',background:section===k?'var(--bg2)':'transparent',color:section===k?'var(--tx)':'var(--mt)'}}>{l}</button>)}
      </div>
      {section==='budget'&&(
        <div>
          <div className="card" style={{marginBottom:12}}>
            <div style={{fontSize:12,color:'var(--mt)',fontWeight:700,textTransform:'uppercase',letterSpacing:.4,marginBottom:12}}>Presupuesto Total Mensual</div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1}}>{editTotal?<input className="fi" type="number" value={tempTotal} inputMode="decimal" onChange={e=>setTempTotal(e.target.value)} style={{fontSize:22,fontWeight:800}} autoFocus/>:<div style={{fontFamily:'Sora',fontSize:28,fontWeight:800,color:'var(--ac)'}}>{fmt(budget.total_budget)}</div>}</div>
              {editTotal?<div style={{display:'flex',gap:6}}><button className="btn btns" style={{width:'auto',padding:'10px 16px'}} onClick={saveTotal}>✓</button><button className="btn btng" style={{width:'auto',padding:'10px 14px'}} onClick={()=>{setEditTotal(false);setTempTotal(String(budget.total_budget))}}>✕</button></div>:<button className="btn btng" style={{width:'auto',padding:'10px 18px',fontSize:13}} onClick={()=>{setTempTotal(String(budget.total_budget));setEditTotal(true)}}>Editar</button>}
            </div>
          </div>
          <div style={{fontSize:12,color:'var(--mt)',fontWeight:700,textTransform:'uppercase',marginBottom:10}}>Por Categoría <span style={{fontSize:11,fontWeight:400,marginLeft:6,textTransform:'none'}}>· toca para editar</span></div>
          {cats.map((c:Category)=>{const spent=gastos.filter((e:Entry)=>e.category_id===c.id).reduce((s:number,e:Entry)=>s+e.amount,0);const bud=budget.cat_budgets[c.id]||0;const pct=bud>0?(spent/bud)*100:0;const isEditing=editCatId===c.id;return(<div key={c.id} className="card" style={{marginBottom:8}}><div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:36,height:36,borderRadius:10,background:c.color+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{c.icon}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700}}>{c.name}</div><div style={{fontSize:11,color:'var(--mt)',marginTop:1}}>Gastado: <span style={{color:pct>=100?'var(--rd)':pct>=80?'var(--yw)':'var(--mt2)'}}>{fmt(spent)}</span>{bud>0&&<span> de {fmt(bud)}</span>}</div></div>{isEditing?<div style={{display:'flex',gap:5,flexShrink:0}}><input className="fi" type="number" value={tempCatVal} inputMode="decimal" onChange={e=>setTempCatVal(e.target.value)} style={{width:90,padding:'6px 8px',fontSize:14,fontWeight:700}} autoFocus/><button className="btn btns" style={{width:'auto',padding:'6px 10px',fontSize:12}} onClick={()=>saveCatBudget(c.id)}>✓</button><button className="btn btng" style={{width:'auto',padding:'6px 10px',fontSize:12}} onClick={()=>setEditCatId(null)}>✕</button></div>:<button onClick={()=>{setEditCatId(c.id);setTempCatVal(String(bud||''))}} style={{background:bud>0?'rgba(79,124,255,.1)':'var(--bg3)',border:bud>0?'1px solid var(--ac)':'1px solid var(--bd)',borderRadius:9,padding:'6px 12px',color:bud>0?'var(--ac)':'var(--mt)',fontSize:12,fontWeight:700,fontFamily:'inherit',cursor:'pointer',flexShrink:0}}>{bud>0?fmt(bud):'+ Budget'}</button>}</div>{bud>0&&<div style={{marginTop:8}}><Prog pct={pct} color={c.color}/><div style={{display:'flex',justifyContent:'space-between',marginTop:3,fontSize:10,color:'var(--mt)'}}><span>{pct.toFixed(0)}% usado</span><span style={{color:bud>=spent?'var(--gn)':'var(--rd)'}}>{bud>=spent?`${fmt(bud-spent)} disponible`:`${fmt(spent-bud)} excedido`}</span></div></div>}</div>)})}
        </div>
      )}
      {section==='cats'&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div style={{fontSize:13,color:'var(--mt)'}}>{cats.length} categorías</div><button onClick={openNewCat} style={{background:'var(--ag)',border:'none',borderRadius:10,padding:'9px 16px',color:'#fff',fontSize:13,fontWeight:700,fontFamily:'inherit',cursor:'pointer'}}>+ Nueva</button></div>
          {cats.map((c:Category)=>{const usedIn=entries.filter((e:Entry)=>e.category_id===c.id).length;return(<div key={c.id} className="er" style={{cursor:'default'}}><div style={{width:38,height:38,borderRadius:11,background:c.color+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{c.icon}</div><div className="en"><div className="enm">{c.name}</div><div className="emt">{usedIn} movimiento{usedIn!==1?'s':''} · {c.is_default?'Predefinida':'Personalizada'}</div></div><div style={{display:'flex',gap:6,flexShrink:0}}><button onClick={()=>openEditCat(c)} style={{background:'var(--bg3)',border:'1px solid var(--bd)',borderRadius:8,padding:'6px 10px',color:'var(--ac)',fontSize:12,fontWeight:700,fontFamily:'inherit',cursor:'pointer'}}>✏️</button>{!c.is_default&&<button onClick={()=>onDeleteCat(c.id)} style={{background:'rgba(244,63,94,.1)',border:'1px solid rgba(244,63,94,.25)',borderRadius:8,padding:'6px 10px',color:'var(--rd)',fontSize:12,fontWeight:700,fontFamily:'inherit',cursor:'pointer'}}>🗑️</button>}</div></div>)})}
        </div>
      )}
      <div style={{marginTop:24,paddingTop:16,borderTop:'1px solid var(--bd)'}}>
        <button onClick={onLogout} className="btn btng" style={{fontSize:13}}>Cerrar sesión</button>
      </div>
      {showNewCat&&(<div className="ovl" onClick={e=>e.target===e.currentTarget&&setShowNewCat(false)}><div className="sht"><div className="hdl"/><div className="sttl">{editCat?'Editar':'Nueva'} Categoría</div><div className="fg"><label className="fl">Nombre</label><input className="fi" type="text" placeholder="Ej: Gym, Mascota..." value={catName} onChange={e=>setCatName(e.target.value)} autoFocus/></div><div className="fg"><label className="fl">Ícono</label><div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>{PRESET_ICONS.map(ic=><button key={ic} onClick={()=>setCatIcon(ic)} style={{width:40,height:40,border:catIcon===ic?'2px solid var(--ac)':'1px solid var(--bd)',borderRadius:10,background:catIcon===ic?'rgba(79,124,255,.12)':'var(--bg3)',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>{ic}</button>)}</div></div><div className="fg"><label className="fl">Color</label><div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>{PRESET_COLORS.map(col=><button key={col} onClick={()=>setCatColor(col)} style={{width:36,height:36,borderRadius:10,background:col,cursor:'pointer',border:catColor===col?'3px solid white':'2px solid transparent'}}/>)}</div><div style={{display:'flex',alignItems:'center',gap:8}}><input type="color" value={catColor} onChange={e=>setCatColor(e.target.value)} style={{width:44,height:36,background:'var(--bg3)',border:'1px solid var(--bd)',borderRadius:9,cursor:'pointer',padding:2}}/><div style={{width:36,height:36,borderRadius:10,background:catColor,border:'1px solid var(--bd)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{catIcon}</div></div></div><button className="btn btnp" onClick={saveCat} style={{marginBottom:8}}>{editCat?'Guardar Cambios':'Crear Categoría'}</button><button className="btn btng" onClick={()=>setShowNewCat(false)}>Cancelar</button></div></div>)}
    </div>
  )
}