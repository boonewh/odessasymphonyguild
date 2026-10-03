"use client";
import { useCallback,useEffect,useState,type FormEvent } from "react";
import { duplicateInvitations,filterInvitations,invitationKey,invitationLabels,type InvitationRow,type InvitationStatus } from "@/lib/gala/invitations";
import styles from "./PaymentLab.module.css";
const states:InvitationStatus[]=["requested","prepared","mailed"];

function MailingEditor({row,saved,started}:{row:InvitationRow;saved:()=>Promise<void>;started:()=>void}) {
  const [status,setStatus]=useState(row.status),[reason,setReason]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const correction=states.indexOf(status)<states.indexOf(row.status);
  async function submit(event:FormEvent){event.preventDefault();if(busy||error)return;setBusy(true);started();
    try{const r=await fetch("/api/gala/invitations",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      requestId:row.request_id,recipientIndex:row.recipient_index,status,revision:row.revision,reason:correction?reason:""})});
      if(!r.ok)throw new Error(r.status===401?"Session expired. Reload and unlock the local admin.":(await r.json()).error);
      await saved();
    }catch(e){setError((e as Error).message||"Cannot confirm this change. Refresh invitations before retrying.");}finally{setBusy(false);}}
  return <form onSubmit={submit} className={styles.assignmentForm}>
    <label>Mailing status for {row.recipient.name}<select value={status} disabled={busy||!!error} onChange={e=>setStatus(e.target.value as InvitationStatus)}>
      {states.map(s=><option key={s} value={s} disabled={states.indexOf(s)>states.indexOf(row.status)+1}>{invitationLabels[s]}</option>)}
    </select></label>
    {correction&&<label>Mailing correction reason<input required minLength={3} maxLength={300} value={reason} disabled={busy||!!error} onChange={e=>setReason(e.target.value)}/></label>}
    <button disabled={busy||!!error||status===row.status||(correction&&reason.trim().length<3)}>{busy?"Saving…":"Save mailing status"}</button>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
  </form>;
}
export default function InvitationMailing(){
  const [rows,setRows]=useState<InvitationRow[]|null>(null),[filter,setFilter]=useState("requested");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[generation,setGeneration]=useState(0);
  const refresh=useCallback(async()=>{setBusy(true);setError("");try{
    const r=await fetch("/api/gala/invitations",{cache:"no-store"});
    if(!r.ok)throw new Error(r.status===401?"Session expired. Reload and unlock the local admin.":(await r.json()).error);
    setRows((await r.json()).invitations);setGeneration(g=>g+1);
  }catch(e){setError((e as Error).message);throw e;}finally{setBusy(false);}},[]);
  useEffect(()=>{void refresh().catch(()=>{});},[refresh]);
  async function saved(){await refresh();setNotice("Mailing status saved. Other recipients are unchanged.");}
  async function download(){setBusy(true);setError("");try{
    const r=await fetch(`/api/gala/invitations?format=csv&filter=${filter}`,{cache:"no-store"});
    if(!r.ok)throw new Error("Export unavailable. Refresh invitations and try again.");
    const url=URL.createObjectURL(await r.blob()),link=document.createElement("a");link.href=url;link.download="gala-2027-development-invitations.csv";
    document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const shown=filterInvitations(rows||[],filter),duplicates=duplicateInvitations(rows||[]);
  return <section className={styles.panel} aria-label="Invitation mailing"><h2>Invitation mailing</h2>
    <p className={styles.note}>Review addresses before preparing envelopes. Mark mailed only after the physical invitation has been sent. These requests are free and do not reserve seats. No mailing or email is sent automatically.</p>
    <div className={styles.tools}><label>Invitation status<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All invitations</option>{states.map(s=><option key={s} value={s}>{invitationLabels[s]}</option>)}</select></label>
      <button disabled={busy} onClick={()=>{setNotice("");void refresh().catch(()=>{});}}>Refresh invitations</button>
      <button disabled={busy||!rows||!!error} onClick={()=>void download()}>Export mailing list (CSV)</button>
    </div>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.success}>{notice}</p>}
    {rows&&<p><strong>This view:</strong> {shown.length} recipient entries · {shown.filter(r=>duplicates.has(invitationKey(r))).length} flagged for duplicate review. Includes all matching requests.</p>}
    {duplicates.size>0&&<p className={styles.note}>Possible duplicates match the same name and address after ignoring capitalization and extra spaces. All entries are retained, including in exports. Review flagged entries before preparing or mailing; different spellings may not be detected.</p>}
    {!rows?<p>{busy?"Loading invitation requests…":"Invitation mailing unavailable."}</p>:!shown.length?<p>No invitations match this view.</p>:
    <div className={`${styles.table} ${styles.assignmentTable}`}><table><thead><tr><th>Recipient / address</th><th>Requested by</th><th>Current status</th><th>Update mailing</th></tr></thead><tbody>
      {shown.map(row=><tr key={invitationKey(row)}>
        <td data-label="Recipient / address">{row.recipient.name}<small>{row.recipient.address}</small>{row.recipient.address2&&<small>{row.recipient.address2}</small>}
          <small>{row.recipient.city}, {row.recipient.state} {row.recipient.zip}</small>
          {duplicates.has(invitationKey(row))&&<strong>Possible duplicate — review</strong>}
          <small>Request {row.request_id} · recipient {row.recipient_index+1}</small></td>
        <td data-label="Requested by">{row.contact.name}<small>{row.contact.email}</small><small>{row.contact.phone}</small></td>
        <td data-label="Current status">{invitationLabels[row.status]}</td>
        <td data-label="Update mailing"><MailingEditor key={`${invitationKey(row)}-${row.revision}-${generation}`} row={row} saved={saved} started={()=>setNotice("")}/></td>
      </tr>)}
    </tbody></table></div>}
    <p className={styles.note}>Corrections to an earlier status require a reason and are recorded. Address editing, duplicate suppression and the final mailing deadline are not enabled yet. Development only; use fictional addresses.</p>
  </section>;
}
