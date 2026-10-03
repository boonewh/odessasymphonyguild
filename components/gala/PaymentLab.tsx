"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { CheckoutRequest, Order } from "@/lib/gala/backend/domain";
import { money, TABLES, quotePurchase, type Product } from "@/lib/gala/model";
import styles from "./PaymentLab.module.css";
import QuickBooksSandbox from "./QuickBooksSandbox";
type Dashboard = { orders: Order[]; inventory: {tier:string;capacity:number;available:number;held:number;paid:number}[]; accounting: {order_id:string;status:string}[] };
const attemptKey = "osg-gala-sandbox-attempt";
export default function PaymentLab({ mode = "testing" }: { mode?: "testing" | "admin" }) {
  const [data,setData]=useState<Dashboard|null>(null); const [locked,setLocked]=useState(false);
  const [token,setToken]=useState(""); const [error,setError]=useState(""); const [notice,setNotice]=useState(""); const [busy,setBusy]=useState(false);
  const [attempt,setAttempt]=useState<CheckoutRequest|null>(null);
  const [kind,setKind]=useState<"tables"|"gifts">("tables"); const [product,setProduct]=useState<Product>("gold");
  const [quantity,setQuantity]=useState(1); const [extras,setExtras]=useState(0); const [agreed,setAgreed]=useState(false);
  const [contact,setContact]=useState({name:"Fictional Gala Buyer",email:"gala-test@example.com",phone:"4325550100"});
  const [filter,setFilter]=useState("paid");
  const refresh=useCallback(async()=>{
    const response=await fetch("/api/gala/orders",{cache:"no-store"});
    if(response.status===401){setLocked(true);setData(null);return;}
    if(!response.ok) throw new Error("Cannot load the development database. Check the local server setup.");
    setData(await response.json());setLocked(false);
  },[]);
  useEffect(()=>{void refresh().catch(e=>setError(e.message));
    try{const saved=sessionStorage.getItem(attemptKey);if(saved)setAttempt(JSON.parse(saved));}catch{sessionStorage.removeItem(attemptKey);}
  },[refresh]);
  useEffect(()=>{if(locked||!data)return;const interval=setInterval(()=>{void refresh().catch(()=>{});},5000);return()=>clearInterval(interval);},[locked,Boolean(data),refresh]);
  const table=TABLES.some(t=>t.id===product);
  const amount=kind==="gifts"?3000:quotePurchase({product,quantity:table?1:quantity,extraSeats:table?extras:0}).total;
  const current=attempt?data?.orders.find(o=>o.id===attempt.requestId):undefined;
  async function login(event:FormEvent){event.preventDefault();setBusy(true);setError("");try{
    const response=await fetch("/api/gala/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});
    if(!response.ok)throw new Error("Sign-in failed. Use the local development token from .env.local.");
    setToken("");await refresh();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function checkout(event:FormEvent){event.preventDefault();setBusy(true);setError("");try{
    const payload:CheckoutRequest=attempt || (kind==="tables"?{requestId:crypto.randomUUID(),kind,contact,allSalesFinal:true,purchase:{product,quantity:table?1:quantity,extraSeats:table?extras:0}}:
      {requestId:crypto.randomUUID(),kind,contact,allSalesFinal:true,gifts:[{student:"Sample Student",grade:"9",roses:2,cookies:1}]});
    if(!attempt&&!agreed)throw new Error("Acknowledge the no-refund policy first.");
    sessionStorage.setItem(attemptKey,JSON.stringify(payload));setAttempt(payload);
    const response=await fetch("/api/gala/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const result=await response.json();if(!response.ok)throw new Error(result.error);
    window.location.assign(result.url);
  }catch(e){setError((e as Error).message);await refresh().catch(()=>{});}finally{setBusy(false);}}
  async function action(path:string,body?:object){setBusy(true);setError("");setNotice("");try{
    const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body||{})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||"Operation failed.");
    setNotice(path.endsWith("expire")?`Verified checkout state: ${result.state}.`:"Reconciliation finished. Pending exceptions remain held for review.");await refresh();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  function reset(){sessionStorage.removeItem(attemptKey);setAttempt(null);setAgreed(false);setNotice("");setError("");}
  return <main className={styles.lab}>
    <span className={styles.badge}>LOCAL SANDBOX · NO REAL PAYMENTS</span>
    <h1>{mode==="admin"?"Gala orders & inventory":"Gala payment testing"}</h1>
    <p className={styles.note}>PathSix Stripe sandbox · OSG Gala Development database. Use fictional details only. All capacities are unapproved test quantities.</p>
    <nav className={styles.nav}><Link href="/gala/preview/testing">Test a purchase</Link><Link href="/gala/preview/admin">Database admin</Link><Link href="/gala/tables">Flyer preview</Link></nav>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.success}>{notice}</p>}
    {locked?<form onSubmit={login} className={styles.panel}><h2>Unlock local testing</h2><p className={styles.note}>Enter GALA_DEVELOPMENT_TOKEN from your local .env.local file. The sign-in lasts eight hours.</p><label>Development token<input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} required/></label><div className={styles.tools}><button disabled={busy}>Unlock sandbox</button></div></form>:!data?<p role="status">Loading development orders…</p>:<>
      <section className={styles.inventory} aria-label="Development inventory">{data.inventory.map(t=><div className={styles.stock} key={t.tier}><strong>{t.tier}</strong><span>{t.available}</span> available of {t.capacity}<p>{t.held} held · {t.paid} paid</p></div>)}</section>
      {mode==="testing"&&<section className={styles.panel}><h2>Test Stripe-hosted checkout</h2>{attempt?<>
        <p>Current test order: <code>{attempt.requestId}</code></p><p>Status: <strong>{current?.status.replaceAll("_"," ")||"Not yet recorded / retry available"}</strong></p>
        {current?.status==="paid"||current?.status==="expired"?<button onClick={reset}>Start another test purchase</button>:<form onSubmit={checkout}><p className={styles.note}>Retrying reuses the same order and checkout. Your selections stay locked while its payment is unresolved.</p><button disabled={busy}>Resume the same checkout</button></form>}
      </>:<form className={styles.form} onSubmit={checkout}>
        <label>Purchase type<select value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="tables">Tables & tickets</option><option value="gifts">Gift test: two roses + one cookie bag</option></select></label>
        {kind==="tables"&&<><label>Product<select value={product} onChange={e=>{setProduct(e.target.value as Product);setQuantity(1);setExtras(0);}}>{TABLES.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}<option value="couples">Couples ticket</option><option value="student-date">Student date ticket</option></select></label>
        <label>{table?"Extra seats":"Quantity"}<select value={table?extras:quantity} onChange={e=>table?setExtras(Number(e.target.value)):setQuantity(Number(e.target.value))}>{Array.from({length:table?3:10},(_,i)=>table?i:i+1).map(v=><option key={v}>{v}</option>)}</select></label></>}
        {(["name","email","phone"] as const).map(field=><label key={field}>{field==="name"?"Buyer name":field==="email"?"Email":"Phone"}<input type={field==="email"?"email":"text"} value={contact[field]} required onChange={e=>setContact({...contact,[field]:e.target.value})}/></label>)}
        <label className={`${styles.wide} ${styles.check}`}><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} required/>I acknowledge: all sales are final, no refunds.</label>
        <button className={styles.wide} disabled={busy}>Open Stripe test checkout · {money(amount)}</button>
      </form>}</section>}
      <section className={styles.panel}><h2>Orders from the development database</h2><div className={styles.tools}>
        <label>Show<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="paid">Paid orders</option><option value="pending">Pending / held</option><option value="expired">Expired unpaid</option><option value="all">All orders</option></select></label>
        <button disabled={busy} onClick={()=>void refresh().catch(e=>setError(e.message))}>Refresh</button><button disabled={busy} onClick={()=>void action("/api/gala/reconcile")}>Reconcile with Stripe</button>
      </div><p className={styles.note}>Latest 100 orders. Only paid orders are ready for fulfillment. Accounting remains queued until explicitly synced to the QuickBooks sandbox below.</p>
      <div className={styles.table}><table><thead><tr><th>Buyer / order</th><th>Purchase</th><th>Total</th><th>Status</th><th>Accounting / action</th></tr></thead><tbody>{data.orders.filter(o=>filter==="all" || (filter==="pending" ? ["reserved","awaiting_payment"].includes(o.status) : o.status===filter)).map(o=><tr key={o.id}>
        <td>{o.details.contact.name}<small>{o.details.contact.email}</small><small>{o.id}</small></td><td>{o.description}{o.details.kind==="gifts"&&o.details.gifts.map((g,i)=><small key={i}>{g.student}, grade {g.grade}: {g.roses} roses / {g.cookies} cookie bags</small>)}</td><td>{money(o.amount)}</td><td>{o.status.replaceAll("_"," ")}</td><td>{data.accounting.find(a=>a.order_id===o.id)?.status||"—"}{["reserved","awaiting_payment"].includes(o.status)&&o.stripe_session_id&&<button disabled={busy} onClick={()=>void action("/api/gala/expire",{orderId:o.id})}>Expire test checkout</button>}</td>
      </tr>)}</tbody></table></div></section>
      <QuickBooksSandbox refresh={refresh} orders={data.orders.filter(o=>o.status==="paid").map(o=>({id:o.id,label:`${o.description} · ${money(o.amount)} · ${o.id.slice(0,8)}`,accountingStatus:data.accounting.find(a=>a.order_id===o.id)?.status||"not queued"}))}/>
    </>}
  </main>;
}
