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
export default function PaymentRecovery(){
  const [data,setData]=useState<Dashboard|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[generation,setGeneration]=useState(0),[busy,setBusy]=useState(false);
  const refresh=useCallback(async()=>{setBusy(true);try{const r=await fetch('/api/gala/recovery',{cache:'no-store'});
    if(!r.ok)throw new Error(r.status===401?'Session expired. Reload and unlock the local admin.':'Recovery status unavailable. Check the local worker and migration 008.');
    setData(await r.json());setError('');setGeneration(g=>g+1);
  }catch(e){setError((e as Error).message);throw e;}finally{setBusy(false);}},[]);
  useEffect(()=>{void refresh().catch(()=>{});},[refresh]);
  const recent=!!data?.lastPollAt&&Date.now()-Date.parse(data.lastPollAt)<180_000;
  return <section className={styles.panel} aria-label="Payment recovery"><h2>Payment recovery</h2>
    <p className={styles.note}>Unconfirmed payments keep their inventory hold. Checks read Stripe before settling or releasing an order. No replacement checkout, new charge or QuickBooks sync is created here.</p>
    <p><strong>{recent?'Worker checked recently':'Worker not recently seen'}</strong> · Last poll: {time(data?.lastPollAt||null)}. Development worker must remain running on this computer.</p>
    <div className={styles.tools}><button disabled={busy} onClick={()=>{setNotice('');void refresh().catch(()=>{});}}>Refresh recovery status</button></div>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.success}>{notice}</p>}
    {data&&<p>{data.total} unresolved orders. Showing up to 100, review cases first. The worker checks the full queue.</p>}
    {data&&!data.entries.length?<p>No unresolved payments.</p>:data&&<div className={`${styles.table} ${styles.assignmentTable}`}><table><thead><tr><th>Order</th><th>Recovery state</th><th>Staff review</th></tr></thead><tbody>{data.entries.map(entry=><tr key={entry.id}>
      <td data-label="Order">{entry.description}<small>{entry.id}</small><small>Created: {time(entry.created_at)}</small><small>Checkout: {entry.stripe_session_id||'Not linked'}</small></td>
      <td data-label="Recovery state">{labels[entry.outcome]||entry.outcome}<small>{entry.attempts} checks · {entry.failures} consecutive failures</small><small>Last check: {time(entry.last_checked_at)}</small><small>Next eligible: {time(entry.next_check_at)}</small></td>
      <td data-label="Staff review">{!entry.stripe_session_id?<p>Investigate the original request in Stripe before retrying. A check cannot recreate a missing checkout or release this hold.</p>:<p>Check Stripe and the connection, then queue another verification if needed. Never infer payment from a receipt screenshot or return URL.</p>}
        <Retry key={`${entry.id}-${generation}`} entry={entry} saved={async()=>{await refresh();setNotice('Another check is queued. The running worker will pick it up; payment and inventory are unchanged.');}}/>
      </td></tr>)}</tbody></table></div>}
    <p className={styles.note}>Review reasons are recorded in the audit log. Manual investigation of missing checkouts remains release work.</p>
  </section>;
}
