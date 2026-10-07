"use client";
import { useCallback,useEffect,useState,type FormEvent } from "react";
import { duplicateInvitations,filterInvitations,invitationKey,invitationLabels,isSuppressed,type InvitationRow,type InvitationStatus } from "@/lib/gala/invitations";
import styles from "./PaymentLab.module.css";
import InvitationAddressEditor from "./InvitationAddressEditor";
import InvitationDuplicateEditor from "./InvitationDuplicateEditor";
const states:InvitationStatus[]=["requested","prepared","mailed"];

function MailingEditor({row,saved,started}:{row:InvitationRow;saved:(recipient?:string,status?:InvitationStatus)=>Promise<void>;started:()=>void}) {
  const [status,setStatus]=useState(row.status),[reason,setReason]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const correction=states.indexOf(status)<states.indexOf(row.status);
  async function submit(event:FormEvent){event.preventDefault();if(busy||error)return;setBusy(true);started();
    try{const r=await fetch("/api/gala/invitations",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      requestId:row.request_id,recipientIndex:row.recipient_index,status,revision:row.revision,reason:correction?reason:""})});
      if(!r.ok)throw new Error(r.status===401?"Session expired. Reload and unlock the local admin.":(await r.json()).error);
      await saved(row.recipient.name,status);
    }catch(e){setError((e as Error).message||"Cannot confirm this change. Refresh invitations before retrying.");}finally{setBusy(false);}}
  return <form onSubmit={submit} className={styles.assignmentForm}>
    <label>Mailing status for {row.recipient.name}<select value={status} disabled={busy||!!error} onChange={e=>setStatus(e.target.value as InvitationStatus)}>
      {states.map(s=><option key={s} value={s} disabled={states.indexOf(s)>states.indexOf(row.status)+1}>{invitationLabels[s]}</option>)}
    </select></label>
    {correction&&<label>Mailing correction reason<input required minLength={3} maxLength={300} value={reason} disabled={busy||!!error} onChange={e=>setReason(e.target.value)}/></label>}
    <button disabled={busy||!!error||status===row.status||(correction&&reason.trim().length<3)}>{busy?"Saving…":"Save mailing status"}</button>
    {row.status==="requested"&&<small>Save Prepared first to enable Mailed.</small>}
    {error&&<p role="alert" className={styles.error}>{error}</p>}
  </form>;
}
export default function InvitationMailing(){
  const [rows,setRows]=useState<InvitationRow[]|null>(null),[filter,setFilter]=useState("all");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[generation,setGeneration]=useState(0);
  const [manualComparison,setManualComparison]=useState(false);
  const refresh=useCallback(async()=>{setBusy(true);setError("");try{
    const r=await fetch("/api/gala/invitations",{cache:"no-store"});
    if(!r.ok)throw new Error(r.status===401?"Session expired. Reload and unlock the local admin.":(await r.json()).error);
    setRows((await r.json()).invitations);setGeneration(g=>g+1);
  }catch(e){setError((e as Error).message);throw e;}finally{setBusy(false);}},[]);
  useEffect(()=>{void refresh().catch(()=>{});},[refresh]);
  async function saved(recipient?:string,status?:InvitationStatus){await refresh();setNotice(recipient&&status
    ?`${recipient}: saved as ${invitationLabels[status]}.${filter!=="all"&&filter!==status?` This entry is now hidden by your filter. Choose ${invitationLabels[status]} or All active invitations to see it.`:""}`
    :"Invitation updated. Other recipients are unchanged.");}
  async function download(){setBusy(true);setError("");try{
    const r=await fetch(`/api/gala/invitations?format=csv&filter=${filter}`,{cache:"no-store"});
    if(!r.ok)throw new Error("Export unavailable. Refresh invitations and try again.");
    const url=URL.createObjectURL(await r.blob()),link=document.createElement("a");link.href=url;link.download="gala-2027-development-invitations.csv";
    document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const shown=filterInvitations(rows||[],filter),duplicates=duplicateInvitations(rows||[]);
  return <section className={styles.panel} aria-label="Invitation mailing"><h2>Invitation mailing</h2>
    <p className={styles.note}>Review addresses before preparing envelopes. Mark mailed only after the physical invitation has been sent. These requests are free and do not reserve seats. No mailing or email is sent automatically.</p>
    <div className={styles.tools}><label>Invitation status<select value={filter} onChange={e=>{setFilter(e.target.value);setNotice("");}}><option value="all">All active invitations</option>{states.map(s=><option key={s} value={s}>{invitationLabels[s]}</option>)}<option value="suppressed">Excluded duplicates</option></select></label>
      <button disabled={busy} onClick={()=>{setNotice("");void refresh().catch(()=>{});}}>Refresh invitations</button>
      <button disabled={busy||!rows||!!error||filter==="suppressed"} onClick={()=>void download()}>Export mailing list (CSV)</button>
    </div>
    <details><summary>Prepare mailing labels</summary>
      <p className={styles.note}>Review addresses and duplicate hints first. Preview 30 labels per Letter sheet (1 × 2⅝ inches); the actual label stock still needs confirmation. Suppressed and mailed entries are excluded. Previewing or printing never changes mailing status.</p>
      <form action="/api/gala/invitations" method="get" target="_blank" rel="noopener" className={styles.tools}>
        <input type="hidden" name="format" value="labels"/>
        <label>Label batch<select name="filter" defaultValue="requested"><option value="requested">Needs preparation</option><option value="prepared">Prepared — reprint labels</option></select></label>
        <label>Used labels to skip<input type="number" name="skip" min={0} max={29} step={1} defaultValue={0} required/></label>
        <button disabled={busy||!rows||!!error}>Preview mailing labels</button>
      </form>
      <ol><li>Resolve duplicate hints and correct addresses.</li><li>Preview labels, test alignment on plain paper, then prepare the envelopes.</li><li>Mark each completed envelope Prepared. Mark Mailed only after sending it.</li></ol>
      <p className={styles.note}>Reopen the preview after changes. Replace old labels after address corrections or duplicate suppression. Use the CSV export for a different label format.</p>
    </details>
    <details><summary>Additional invitation tools</summary>
      <label className={styles.check}><input type="checkbox" checked={manualComparison} onChange={e=>setManualComparison(e.target.checked)}/>Compare invitations manually</label>
      <p>Use this only when you notice the same person listed with different spellings. Detected duplicates are always shown for review.</p>
    </details>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.success}>{notice}</p>}
    {rows&&<p><strong>This view:</strong> {shown.length} recipient entries · {shown.filter(r=>duplicates.has(invitationKey(r))).length} flagged for duplicate review. Includes all matching requests.</p>}
    <p className={styles.note}>Excluded duplicates ({rows?.filter(isSuppressed).length||0}) are not printed or mailed. Choose Excluded duplicates above to review or restore them. Invitations reviewed as separate remain on the mailing list; changing an address requires a fresh review.</p>
    {duplicates.size>0&&<p className={styles.note}>Possible duplicates match the same name and address after ignoring capitalization and extra spaces. Review flagged entries before preparing or mailing; different spellings may not be detected.</p>}
    {!rows?<p>{busy?"Loading invitation requests…":"Invitation mailing unavailable."}</p>:!shown.length?<p>No invitations match this view.</p>:
    <div className={`${styles.table} ${styles.assignmentTable}`}><table><thead><tr><th>Recipient / address</th><th>Requested by</th><th>Current status</th><th>Update mailing</th></tr></thead><tbody>
      {shown.map(row=><tr key={invitationKey(row)}>
        <td data-label="Recipient / address">{row.recipient.name}<small>{row.recipient.address}</small>{row.recipient.address2&&<small>{row.recipient.address2}</small>}
          <small>{row.recipient.city}, {row.recipient.state} {row.recipient.zip}</small>
          {duplicates.has(invitationKey(row))&&<strong>Possible duplicate — review</strong>}
          <details><summary>Request reference</summary><small>{row.request_id} · recipient {row.recipient_index+1}</small></details>
          {!isSuppressed(row)&&(rows||[]).some(other=>other.duplicate_request_id===row.request_id&&other.duplicate_recipient_index===row.recipient_index)
            ? <p>Kept for mailing; another request was excluded as its duplicate. See the resolved duplicate details.</p>
            : !isSuppressed(row)&&<InvitationAddressEditor key={`${invitationKey(row)}-${row.revision}-${generation}`} row={row} saved={saved} started={()=>setNotice("")}/>}</td>
        <td data-label="Requested by">{row.contact.name}<small>{row.contact.email}</small><small>{row.contact.phone}</small></td>
        <td data-label="Current status">{isSuppressed(row)?"Excluded duplicate":invitationLabels[row.status]}</td>
        <td data-label="Update mailing">{!isSuppressed(row)&&<MailingEditor key={`${invitationKey(row)}-${row.revision}-${generation}`} row={row} saved={saved} started={()=>setNotice("")}/>}
          <InvitationDuplicateEditor key={`duplicate-${invitationKey(row)}-${row.revision}-${generation}`} row={row} rows={rows||[]} saved={saved} started={()=>setNotice("")} allowManual={manualComparison} showSuppressed={()=>{setFilter("suppressed");setNotice("");}}/></td>
      </tr>)}
    </tbody></table></div>}
    <p className={styles.note}>Corrections and duplicate decisions require a reason and are recorded. No records are deleted. The final mailing deadline is not enabled yet. Development only; use fictional addresses.</p>
  </section>;
}
