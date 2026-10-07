"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import type { CheckoutRequest, Order } from "@/lib/gala/backend/domain";
import { money, TABLES, quotePurchase, type Product } from "@/lib/gala/model";
import { accountingLabel } from "@/lib/gala/display";
import styles from "./PaymentLab.module.css";
import QuickBooksSandbox from "./QuickBooksSandbox";
import TableAssignments from "./TableAssignments";
import GiftFulfillment from "./GiftFulfillment";
import InvitationMailing from "./InvitationMailing";
import PaymentRecovery from "./PaymentRecovery";
type Dashboard = { orders: Order[]; inventory: {tier:string;capacity:number;available:number;held:number;paid:number}[]; accounting: {order_id:string;status:string}[] };
const attemptKey = "osg-gala-sandbox-attempt";
const adminTabs = [
  {id:"orders",label:"Orders"}, {id:"assignments",label:"Table assignments"},
  {id:"gifts",label:"Gifts"}, {id:"invitations",label:"Invitations"}, {id:"accounting",label:"Accounting"},
] as const;
type AdminTab = typeof adminTabs[number]["id"];
export default function PaymentLab({ mode = "testing", individual = false }: { mode?: "testing" | "admin"; individual?: boolean }) {
  const [email,setEmail]=useState("");
  const [accounting,setAccounting]=useState(!individual);
  const [data,setData]=useState<Dashboard|null>(null); const [locked,setLocked]=useState(false);
  const [token,setToken]=useState(""); const [error,setError]=useState(""); const [notice,setNotice]=useState(""); const [busy,setBusy]=useState(false);
  const [attempt,setAttempt]=useState<CheckoutRequest|null>(null);
  const [kind,setKind]=useState<"tables"|"gifts">("tables"); const [product,setProduct]=useState<Product>("gold");
  const [quantity,setQuantity]=useState(1); const [extras,setExtras]=useState(0); const [agreed,setAgreed]=useState(false);
  const [contact,setContact]=useState({name:"Fictional Gala Buyer",email:"gala-test@example.com",phone:"4325550100"});
  const [filter,setFilter]=useState("paid");
  const [tab,setTab]=useState<AdminTab>("orders");
  const [recoveryAttention,setRecoveryAttention]=useState("");
  const tabButtons=useRef<Partial<Record<AdminTab,HTMLButtonElement|null>>>({});
  const availableTabs=adminTabs.filter(item=>item.id!=="accounting"||accounting);
  const activeTab=tab==="accounting"&&!accounting?"orders":tab;
  function tabKey(event:KeyboardEvent<HTMLButtonElement>,id:AdminTab){
    const index=availableTabs.findIndex(item=>item.id===id);
    const next=event.key==="ArrowRight"?(index+1)%availableTabs.length:event.key==="ArrowLeft"?(index+availableTabs.length-1)%availableTabs.length
      :event.key==="Home"?0:event.key==="End"?availableTabs.length-1:-1;
    if(next<0)return;
    event.preventDefault();const nextId=availableTabs[next].id;setTab(nextId);tabButtons.current[nextId]?.focus();
  }
  const refresh=useCallback(async()=>{
    const response=await fetch("/api/gala/orders",{cache:"no-store"});
    if(response.status===401){setLocked(true);setData(null);return;}
    if(!response.ok) throw new Error("Cannot load test orders. Try refreshing; if this continues, contact the test organizer.");
    setData(await response.json());setLocked(false);
    if(individual){const access=await fetch("/api/gala/staff-session",{cache:"no-store"});setAccounting(access.ok && (await access.json()).accounting===true);}
  },[individual]);
  useEffect(()=>{void refresh().catch(e=>setError(e.message));
    try{const saved=sessionStorage.getItem(attemptKey);if(saved)setAttempt(JSON.parse(saved));}catch{sessionStorage.removeItem(attemptKey);}
  },[refresh]);
  useEffect(()=>{if(locked||!data)return;const interval=setInterval(()=>{void refresh().catch(()=>{});},5000);return()=>clearInterval(interval);},[locked,Boolean(data),refresh]);
  const table=TABLES.some(t=>t.id===product);
  const amount=kind==="gifts"?3000:quotePurchase({product,quantity:table?1:quantity,extraSeats:table?extras:0}).total;
  const current=attempt?data?.orders.find(o=>o.id===attempt.requestId):undefined;
  async function login(event:FormEvent){event.preventDefault();setBusy(true);setError("");try{
    const response=await fetch(individual?"/api/gala/staff-session":"/api/gala/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(individual?{email,password:token}:{token})});
    if(response.status===429){const wait=Number(response.headers.get("Retry-After"));throw new Error(`Too many sign-in attempts. Try again in ${Number.isFinite(wait)&&wait>0?Math.max(1,Math.ceil(wait/60)):15} minutes.`);}
    if(response.status===503)throw new Error("Staff sign-in is temporarily unavailable. Try again shortly.");
    if(!response.ok)throw new Error(individual?"Sign-in failed. An enabled Gala staff account is required.":"Sign-in failed. Check your test access code with the test organizer.");
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
    setNotice(path.endsWith("expire")?`Checkout status checked: ${result.state}.`:"Payment check finished. Orders without a confirmed result still keep their table reservation.");await refresh();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  function reset(){sessionStorage.removeItem(attemptKey);setAttempt(null);setAgreed(false);setNotice("");setError("");}
  async function logout(){setBusy(true);try{const response=await fetch(individual?"/api/gala/staff-session":"/api/gala/session",{method:"DELETE"});if(!response.ok)throw new Error("Sign-out not confirmed. Try again.");setData(null);setLocked(true);setAccounting(!individual);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <main className={styles.lab}>
    <span className={styles.badge}>TEST SITE · NO REAL PAYMENTS</span>
    <h1>{mode==="admin"?"Gala administration":"Payment testing tools"}</h1>
    <p className={styles.note}>Practice with fictional names and contact details. Test orders are separate from live records. Table quantities are for testing and have not been approved for sale.</p>
    <nav className={styles.nav} aria-label="Gala test pages"><Link href="/gala/tables">Tables & tickets</Link><Link href="/gala/gifts">Celebration gifts</Link><Link href="/gala/invitations">Request invitations</Link><Link href="/gala/preview/admin">Gala admin</Link></nav>
    <details className={styles.testHelp}><summary>How to test the Gala website</summary>
      <ol><li>Choose Tables &amp; tickets, Celebration gifts or Request invitations above. Enter fictional details you will recognize later.</li>
        <li>For purchases, use test card <strong>4242 4242 4242 4242</strong>, expiration <strong>12/34</strong> and security code <strong>123</strong>. Never enter a real card.</li>
        <li>Return to Gala admin to find your order, assign a table, prepare gifts or update invitation mailing status. Tables and gifts use separate checkouts.</li></ol>
      <p>No physical invitations, gifts or customer emails are sent by this test.</p>
    </details>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.success}>{notice}</p>}
    {!locked&&data&&<button disabled={busy} onClick={()=>void logout()}>Sign out</button>}
    {locked?<form onSubmit={login} className={styles.panel}><h2>{individual?"Gala staff sign-in":"Sign in to the test site"}</h2><p className={styles.note}>{individual?"Use the staff account provided for this test.":"Use the access code provided by the test organizer."} You stay signed in for up to eight hours.</p>{individual&&<label>Email<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label>}<label>{individual?"Password":"Test access code"}<input type="password" autoComplete={individual?"current-password":"off"} value={token} onChange={e=>setToken(e.target.value)} required/></label><div className={styles.tools}><button disabled={busy}>Sign in</button></div></form>:!data?<p role="status">Loading test orders…</p>:<>
      {mode==="admin"&&<>
        <div className={styles.adminTabs} role="tablist" aria-label="Gala admin sections">
          {availableTabs.map(item=><button key={item.id} type="button" role="tab" id={`gala-tab-${item.id}`} aria-controls={`gala-panel-${item.id}`}
            aria-selected={activeTab===item.id} tabIndex={activeTab===item.id?0:-1} ref={element=>{tabButtons.current[item.id]=element;}}
            onClick={()=>setTab(item.id)} onKeyDown={event=>tabKey(event,item.id)}>{item.label}</button>)}
        </div>
        {recoveryAttention&&<div className={styles.recoveryAlert} role="status"><span>{recoveryAttention}</span>
          {activeTab!=="orders"&&<button type="button" onClick={()=>{setTab("orders");tabButtons.current.orders?.focus();}}>View in Orders</button>}
        </div>}
      </>}
      {/* Keep panels mounted so switching tabs preserves filters and unsaved edits. */}
      <div role={mode==="admin"?"tabpanel":undefined} id="gala-panel-orders" aria-labelledby={mode==="admin"?"gala-tab-orders":undefined}
        tabIndex={mode==="admin"?0:undefined} hidden={mode==="admin"&&activeTab!=="orders"}>
      <section className={styles.inventory} aria-label="Test table availability">{data.inventory.map(t=><div className={styles.stock} key={t.tier}><strong>{t.tier}</strong><span>{t.available}</span> available of {t.capacity}<p>{t.held} awaiting payment · {t.paid} paid</p></div>)}</section>
      {individual&&mode==="testing"&&<p>Use the <Link href="/gala/tables">customer table form</Link> or <Link href="/gala/gifts">gift form</Link> to test a customer checkout.</p>}
      {mode==="testing"&&!individual&&<section className={styles.panel}><h2>Test Stripe-hosted checkout</h2>{attempt?<>
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
      <section className={styles.panel}><h2>Test orders</h2><div className={styles.tools}>
        <label>Show<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="paid">Paid orders</option><option value="pending">Awaiting payment</option><option value="expired">Closed without payment</option><option value="all">All orders</option></select></label>
        <button disabled={busy} onClick={()=>void refresh().catch(e=>setError(e.message))}>Refresh orders</button><button disabled={busy} onClick={()=>void action("/api/gala/reconcile")}>Check payment updates</button>
      </div><p className={styles.note}>Latest 100 orders. Only paid orders are ready for table assignment or gift preparation. {accounting?(mode==="admin"?"The Accounting tab shows whether each order has been recorded in QuickBooks.":"Test accounting below shows whether each order has been recorded in QuickBooks."):"Accounting is handled by staff with accounting access."}</p>
      <div className={styles.table}><table><thead><tr><th>Buyer / order</th><th>Purchase</th><th>Total</th><th>Status</th><th>Accounting / action</th></tr></thead><tbody>{data.orders.filter(o=>filter==="all" || (filter==="pending" ? ["reserved","awaiting_payment"].includes(o.status) : o.status===filter)).map(o=><tr key={o.id}>
        <td>{o.details.contact.name}<small>{o.details.contact.email}</small><details><summary>Order reference</summary><small>{o.id}</small></details></td><td>{o.description}{o.details.kind==="gifts"&&o.details.gifts.map((g,i)=><small key={i}>{g.student}, grade {g.grade}: {g.roses} roses / {g.cookies} cookie bags</small>)}</td><td>{money(o.amount)}</td><td>{o.status==="paid"?"Paid":o.status==="expired"?"Closed without payment":"Awaiting payment"}</td><td>{accountingLabel(data.accounting.find(a=>a.order_id===o.id)?.status)}{["reserved","awaiting_payment"].includes(o.status)&&o.stripe_session_id&&<button disabled={busy} onClick={()=>void action("/api/gala/expire",{orderId:o.id})}>Close unpaid checkout</button>}</td>
      </tr>)}</tbody></table></div></section>
      {mode==="admin" && <PaymentRecovery onAttention={setRecoveryAttention}/>}
      </div>
      {mode==="admin"&&<>
        <div role="tabpanel" id="gala-panel-assignments" aria-labelledby="gala-tab-assignments" tabIndex={0} hidden={activeTab!=="assignments"}><TableAssignments/></div>
        <div role="tabpanel" id="gala-panel-gifts" aria-labelledby="gala-tab-gifts" tabIndex={0} hidden={activeTab!=="gifts"}><GiftFulfillment/></div>
        <div role="tabpanel" id="gala-panel-invitations" aria-labelledby="gala-tab-invitations" tabIndex={0} hidden={activeTab!=="invitations"}><InvitationMailing/></div>
      </>}
      {accounting&&<div role={mode==="admin"?"tabpanel":undefined} id="gala-panel-accounting" aria-labelledby={mode==="admin"?"gala-tab-accounting":undefined}
        tabIndex={mode==="admin"?0:undefined} hidden={mode==="admin"&&activeTab!=="accounting"}>
        <QuickBooksSandbox refresh={refresh} orders={data.orders.filter(o=>o.status==="paid").map(o=>({id:o.id,label:`${o.description} · ${money(o.amount)} · ${o.id.slice(0,8)}`,accountingStatus:data.accounting.find(a=>a.order_id===o.id)?.status||"not queued"}))}/>
      </div>}
    </>}
  </main>;
}
