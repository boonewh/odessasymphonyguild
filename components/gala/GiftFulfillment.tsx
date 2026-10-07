"use client";
import { useCallback,useEffect,useState,type FormEvent } from "react";
import { filterGifts,giftLabels,giftTotals,type GiftRow,type GiftStatus } from "@/lib/gala/gift-fulfillment";
import styles from "./PaymentLab.module.css";
const states:GiftStatus[]=["pending","prepared","delivered"];

function GiftEditor({row,saved,started}:{row:GiftRow;saved:(student:string,status:GiftStatus)=>Promise<void>;started:()=>void}) {
  const [status,setStatus]=useState(row.status),[reason,setReason]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const correction=states.indexOf(status)<states.indexOf(row.status);
  async function submit(event:FormEvent) {
    event.preventDefault();if(busy||error)return;setBusy(true);started();
    try {
      const r=await fetch("/api/gala/gifts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        orderId:row.order_id,recipientIndex:row.recipient_index,status,revision:row.revision,reason:correction?reason:""})});
      if(!r.ok)throw new Error(r.status===401?"Session expired. Reload and unlock the local admin.":(await r.json()).error);
      await saved(row.student,status);
    }catch(e){setError((e as Error).message||"Cannot confirm this update. Refresh gifts before retrying.");}
    finally{setBusy(false);}
  }
  return <form onSubmit={submit} className={styles.assignmentForm}>
    <label>Status for {row.student}<select value={status} disabled={busy||!!error} onChange={e=>setStatus(e.target.value as GiftStatus)}>
      {states.map(s=><option key={s} value={s} disabled={states.indexOf(s)>states.indexOf(row.status)+1}>{giftLabels[s]}</option>)}
    </select></label>
    {correction&&<label>Correction reason<input required minLength={3} maxLength={300} value={reason} disabled={busy||!!error} onChange={e=>setReason(e.target.value)}/></label>}
    <button disabled={busy||!!error||status===row.status||(correction&&reason.trim().length<3)}>{busy?"Saving…":"Save gift status"}</button>
    {row.status==="pending"&&<small>Save Prepared first to enable Handed out.</small>}
    {error&&<p role="alert" className={styles.error}>{error}</p>}
  </form>;
}

export default function GiftFulfillment() {
  const [rows,setRows]=useState<GiftRow[]|null>(null),[filter,setFilter]=useState("all");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[generation,setGeneration]=useState(0);
  const refresh=useCallback(async()=>{
    setBusy(true);setError("");
    try {
      const r=await fetch("/api/gala/gifts",{cache:"no-store"});
      if(!r.ok)throw new Error(r.status===401?"Session expired. Reload and unlock the local admin.":(await r.json()).error);
      setRows((await r.json()).gifts);setGeneration(g=>g+1);
    }catch(e){setError((e as Error).message);throw e;}finally{setBusy(false);}
  },[]);
  useEffect(()=>{void refresh().catch(()=>{});},[refresh]);
  async function saved(student:string,status:GiftStatus){await refresh();setNotice(`${student}: saved as ${giftLabels[status]}.${filter!=="all"&&filter!==status?` This entry is now hidden by your filter. Choose ${giftLabels[status]} or All paid gifts to see it.`:""}`);}
  async function download(){setBusy(true);setError("");try{
    const r=await fetch(`/api/gala/gifts?format=csv&filter=${filter}`,{cache:"no-store"});
    if(!r.ok)throw new Error("Export unavailable. Refresh gifts and try again.");
    const url=URL.createObjectURL(await r.blob()),link=document.createElement("a");
    link.href=url;link.download="gala-2027-development-gifts.csv";document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const shown=filterGifts(rows||[],filter),totals=giftTotals(shown);
  return <section className={styles.panel} aria-label="Paid gift fulfillment"><h2>Paid gift fulfillment</h2>
    <p className={styles.note}>Prepare and hand out each student's complete bundle of roses and cookie bags. Only verified paid orders appear. Same-name entries remain separate purchases; do not merge them. Each cookie bag contains two cookies.</p>
    <div className={styles.tools}><label>Gift fulfillment status<select value={filter} onChange={e=>{setFilter(e.target.value);setNotice("");}}>
      <option value="all">All paid gifts</option>{states.map(s=><option key={s} value={s}>{giftLabels[s]}</option>)}
    </select></label>
      <button disabled={busy} onClick={()=>{setNotice("");void refresh().catch(()=>{});}}>Refresh gifts</button>
      <button disabled={busy||!rows||!!error} onClick={()=>void download()}>Export gift list (CSV)</button>
    </div>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.success}>{notice}</p>}
    {rows&&<p><strong>This view:</strong> {totals.recipients} recipient entries · {totals.roses} roses · {totals.cookies} cookie bags. Includes all matching paid orders.</p>}
    {!rows?<p>{busy?"Loading paid gifts…":"Gift fulfillment unavailable."}</p>:shown.length===0?<p>No paid gifts match this view.</p>:
      <div className={`${styles.table} ${styles.assignmentTable}`}><table><thead><tr><th>Student / grade</th><th>Purchased by</th><th>Gift quantities</th><th>Current status</th><th>Update fulfillment</th></tr></thead>
        <tbody>{shown.map(row=><tr key={`${row.order_id}-${row.recipient_index}`}>
          <td data-label="Student / grade">{row.student}<small>Grade {row.grade}</small><details><summary>Order reference</summary><small>{row.order_id} · recipient {row.recipient_index+1}</small></details></td>
          <td data-label="Purchased by">{row.buyer.name}<small>{row.buyer.email}</small><small>{row.buyer.phone}</small></td>
          <td data-label="Gift quantities">{row.roses} roses<br/>{row.cookies} cookie bags</td><td data-label="Current status">{giftLabels[row.status]}</td>
          <td data-label="Update fulfillment"><GiftEditor key={`${row.order_id}-${row.recipient_index}-${row.revision}-${generation}`} row={row} saved={saved} started={()=>setNotice("")}/></td>
        </tr>)}</tbody></table></div>}
    <p className={styles.note}>Use status changes only after the work is done. To correct a mistake, select an earlier status and give a reason. Corrections are recorded; orders, payments and quantities remain unchanged. Development only.</p>
  </section>;
}
