"use client";
import {useCallback,useEffect,useState,type FormEvent} from 'react';
import styles from './PaymentLab.module.css';
type Entry={id:string;description:string;created_at:string;stripe_session_id:string|null;outcome:string;attempts:number;failures:number;last_checked_at:string|null;next_check_at:string|null;lease_until:string|null};
type Dashboard={lastPollAt:string|null;total:number;entries:Entry[]};
const labels:Record<string,string>={waiting:'Waiting for first check',pending:'Awaiting provider confirmation',creation_needs_review:'Checkout link needs investigation',retry_required:'Verification failed — retry scheduled'};
const time=(value:string|null)=>value?new Date(value).toLocaleString():'Not yet';
function Retry({entry,saved}:{entry:Entry;saved:()=>Promise<void>}){
  const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(event:FormEvent){event.preventDefault();if(busy||error)return;setBusy(true);
    try{const r=await fetch('/api/gala/recovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:entry.id,reason})});
      if(!r.ok)throw new Error('Retry not confirmed. Refresh before trying again.');await saved();setReason('');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <form onSubmit={submit} className={styles.assignmentForm}><label>Review reason for {entry.id.slice(0,8)}<input value={reason} onChange={e=>setReason(e.target.value)} minLength={3} maxLength={300} required disabled={busy||!!error}/></label>
    <button disabled={busy||!!error||reason.trim().length<3||(!!entry.lease_until&&Date.parse(entry.lease_until)>Date.now())}>Queue another check</button>
    {error&&<p role="alert" className={styles.error}>{error}</p>}</form>;
}
export default function PaymentRecovery({onAttention}:{onAttention?:(message:string)=>void}){
  const [data,setData]=useState<Dashboard|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[generation,setGeneration]=useState(0),[busy,setBusy]=useState(false);
  const refresh=useCallback(async(resetEditors=true)=>{setBusy(true);try{const r=await fetch('/api/gala/recovery',{cache:'no-store'});
    if(!r.ok)throw new Error(r.status===401?'Your session expired. Reload and sign in again.':'Payment checks are unavailable. Contact the test organizer.');
    setData(await r.json());setError('');if(resetEditors)setGeneration(g=>g+1);
  }catch(e){setError((e as Error).message);throw e;}finally{setBusy(false);}},[]);
  useEffect(()=>{void refresh().catch(()=>{});},[refresh]);
  useEffect(()=>{const timer=setInterval(()=>{void refresh(false).catch(()=>{});},60_000);return()=>clearInterval(timer);},[refresh]);
  const recent=!!data?.lastPollAt&&Date.now()-Date.parse(data.lastPollAt)<180_000;
  const attention=error?'Payment status could not be checked. Contact the test organizer.'
    :!data?'':data.total>0?`${data.total} payment${data.total===1?' is':'s are'} awaiting confirmation. See payment checks in Orders.`
    :!recent?'Automatic payment checks are paused. Contact the test organizer before testing a purchase.':'';
  useEffect(()=>{onAttention?.(attention);},[attention,onAttention]);
  return <section className={styles.panel} aria-label="Payment recovery"><h2>Payment checks</h2>
    <p className={styles.note}>If a payment result is unclear, the table stays reserved until it is confirmed. These checks never charge a buyer again.</p>
    <p><strong>{!data?'Checking availability…':recent?'Automatic checks are running':'Automatic checks need the test organizer’s attention'}</strong></p>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.success}>{notice}</p>}
    {data&&<p>{data.total===0?'All current orders have a confirmed payment result.':`${data.total} orders are awaiting a confirmed payment result.`}</p>}
    <details><summary>Payment troubleshooting — for the test organizer</summary>
    <p>Last automatic check: {time(data?.lastPollAt||null)}. The test organizer can check the payment-check service if this stops updating.</p>
    <div className={styles.tools}><button disabled={busy} onClick={()=>{setNotice('');void refresh().catch(()=>{});}}>Refresh payment checks</button></div>
    {data&&data.entries.length>0&&<div className={`${styles.table} ${styles.assignmentTable}`}><table><thead><tr><th>Order</th><th>Payment check status</th><th>Staff review</th></tr></thead><tbody>{data.entries.map(entry=><tr key={entry.id}>
      <td data-label="Order">{entry.description}<small>{entry.id}</small><small>Created: {time(entry.created_at)}</small><small>Checkout: {entry.stripe_session_id||'Not linked'}</small></td>
      <td data-label="Payment check status">{labels[entry.outcome]||entry.outcome}<small>{entry.attempts} checks · {entry.failures} consecutive failures</small><small>Last check: {time(entry.last_checked_at)}</small><small>Next eligible: {time(entry.next_check_at)}</small></td>
      <td data-label="Staff review">{!entry.stripe_session_id?<p>Investigate the original request in Stripe before retrying. A check cannot recreate a missing checkout or release this hold.</p>:<p>Check Stripe and the connection, then queue another verification if needed. Never infer payment from a receipt screenshot or return URL.</p>}
        <Retry key={`${entry.id}-${generation}`} entry={entry} saved={async()=>{await refresh();setNotice('Another check is queued. The running worker will pick it up; payment and inventory are unchanged.');}}/>
      </td></tr>)}</tbody></table></div>}
    <p className={styles.note}>Review reasons are saved with each change. Showing up to 100 orders needing attention.</p>
    </details>
  </section>;
}
