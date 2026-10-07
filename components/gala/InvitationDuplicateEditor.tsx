"use client";
import { useState, type FormEvent } from "react";
import { duplicateCandidates, invitationKey, invitationLabels, isSuppressed, type InvitationRow } from "@/lib/gala/invitations";
import styles from "./PaymentLab.module.css";

function InvitationCard({entry,title}:{entry:InvitationRow;title:string}) {
  const address=entry.recipient;
  return <div className={styles.comparisonCard}>
    <strong>{title}</strong>
    <p>{address.name}<br/>{address.address}{address.address2&&<><br/>{address.address2}</>}<br/>{address.city}, {address.state} {address.zip}</p>
    <p>Requested by {entry.contact.name}<small>{entry.contact.email}</small></p>
    <small>Request {entry.request_id.slice(0,8)} · recipient {entry.recipient_index+1}</small>
  </div>;
}

export default function InvitationDuplicateEditor({ row, rows, saved, started, showSuppressed, allowManual=false }: {
  row: InvitationRow; rows: InvitationRow[]; saved: () => Promise<void>; started: () => void; showSuppressed:()=>void; allowManual?:boolean;
}) {
  const candidates = duplicateCandidates(row, rows);
  const options = rows.filter(other => !isSuppressed(other) && invitationKey(other) !== invitationKey(row)
    && (allowManual||candidates.some(candidate=>invitationKey(candidate)===invitationKey(other))));
  const [targetKey, setTargetKey] = useState(candidates.length === 1 ? invitationKey(candidates[0]) : "");
  const [decision, setDecision] = useState("separate");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const suppressed = isSuppressed(row);
  const retained = rows.find(other => other.request_id === row.duplicate_request_id && other.recipient_index === row.duplicate_recipient_index);
  const linked = rows.filter(other => other.duplicate_request_id === row.request_id && other.duplicate_recipient_index === row.recipient_index);
  const target = options.find(other => invitationKey(other) === targetKey);
  const maySuppress = row.status !== "mailed" && linked.length === 0;
  const separate = rows.filter(other=>row.separate_from?.includes(invitationKey(other)));
  const summary = suppressed ? "Excluded duplicate — view or restore"
    : candidates.length ? `Review ${candidates.length} possible duplicate${candidates.length===1?"":"s"}`
    : linked.length ? `Duplicate resolved — ${linked.length} excluded`
    : separate.length ? "Reviewed — kept separate" : "Compare with another invitation";
  const comparisonPicker = <label>{candidates.length?"Choose an invitation to compare":"Compare manually with"}<select value={targetKey} disabled={busy||!!error} onChange={e=>{setTargetKey(e.target.value);setDecision("separate");setReason("");}}>
    <option value="">Select another invitation</option>
    {options.map(other=><option key={invitationKey(other)} value={invitationKey(other)}>
      {candidates.some(candidate=>invitationKey(candidate)===invitationKey(other))?"Possible match: ":""}{other.recipient.name} — {other.recipient.address} {other.recipient.address2} · {other.request_id.slice(0,8)} / {other.recipient_index+1}
    </option>)}
  </select></label>;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || error || (!suppressed && !target)) return;
    setBusy(true); started();
    try {
      const response = await fetch("/api/gala/invitations", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          action: "duplicate", decision: suppressed ? "restore" : decision,
          requestId: row.request_id, recipientIndex: row.recipient_index, revision: row.revision, reason,
          ...(!suppressed && target ? { targetRequestId: target.request_id, targetRecipientIndex: target.recipient_index, targetRevision: target.revision } : {}),
        }),
      });
      if (!response.ok) throw new Error(response.status === 401 ? "Session expired. Reload and unlock the local admin."
        : "Decision not confirmed. Refresh invitations before retrying; either entry may have changed.");
      await saved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  if(!suppressed&&!candidates.length&&!linked.length&&!separate.length&&!allowManual)return null;
  return <details className={styles.duplicateReview}>
    <summary>{summary}</summary>
    <form className={styles.assignmentForm} onSubmit={submit} aria-label={`Duplicate review for ${row.recipient.name}`}>
      {suppressed ? <>
        <p>This invitation was excluded as a duplicate. Do not prepare or mail it.</p>
        <div className={styles.comparisonGrid}>
          <InvitationCard entry={row} title="Excluded from mailing"/>
          {retained&&<InvitationCard entry={retained} title="Use this invitation instead"/>}
        </div>
        {!retained&&<p>Kept invitation: request {row.duplicate_request_id} · recipient {(row.duplicate_recipient_index??0)+1}.</p>}
        <p>Restore only if these should be two separate invitations. Restoring returns this entry to Needs preparation for another review.</p>
      </> : <>
        {linked.length>0&&<>
          <p><strong>Already resolved.</strong> This is the invitation being kept. {linked.length===1?"The duplicate below is":"The duplicates below are"} excluded from mailing and label exports.</p>
          <div className={styles.comparisonGrid}>
            <InvitationCard entry={row} title="Kept for mailing"/>
            {linked.map(other=><InvitationCard key={invitationKey(other)} entry={other} title="Duplicate — excluded from mailing"/>)}
          </div>
          <button type="button" onClick={showSuppressed}>View excluded invitations / restore</button>
        </>}
        <p>{candidates.length
          ?`${candidates.length} possible duplicate${candidates.length===1?" has":"s have"} the same name and address. Compare the requests before deciding.`
          :linked.length||separate.length?"No additional possible duplicates need review.":"No possible duplicates found. No action is needed unless you recognize another request as the same person."}</p>
        {separate.length>0&&<details><summary>Invitations already reviewed and kept separate ({separate.length})</summary>
          {separate.map(other=><InvitationCard key={invitationKey(other)} entry={other} title="Kept as a separate invitation"/>)}
        </details>}
        {(candidates.length>0||allowManual)&&(!candidates.length&&(linked.length>0||separate.length>0)
          ?<details><summary>Compare with another invitation</summary>{comparisonPicker}</details>:comparisonPicker)}
        {target&&<>
        <div className={styles.comparisonGrid}>
          <InvitationCard entry={row} title="This invitation"/>
          <InvitationCard entry={target} title="Other invitation"/>
        </div>
        <p>Other invitation status: {invitationLabels[target.status]}.</p>
        <label>Decision<select value={decision} disabled={busy || !!error} onChange={e => setDecision(e.target.value)}>
          <option value="separate">These are separate requests — keep both</option>
          <option value="suppress" disabled={!maySuppress}>These are duplicates — exclude this invitation, keep the other</option>
        </select></label>
        {!maySuppress && <p>{row.status==="mailed"?"This invitation has already been mailed and cannot be excluded.":"This invitation is being kept for the excluded duplicates shown above. Restore those entries before excluding it."}</p>}
        {decision === "suppress" && <p>Exclude request {row.request_id.slice(0,8)} / {row.recipient_index+1}. Keep request {target.request_id.slice(0,8)} / {target.recipient_index+1}. Remove any prepared envelope or label for the excluded invitation.</p>}
        </>}
      </>}
      {(suppressed||target)&&<>
      <label>{suppressed?"Reason for restoring":"Reason for this decision"}<input required minLength={3} maxLength={300} value={reason} disabled={busy || !!error} onChange={e => setReason(e.target.value)} /></label>
      <button disabled={busy || !!error || reason.trim().length < 3 || (!suppressed && (!target || (decision === "suppress" && !maySuppress)))}>
        {busy ? "Saving…" : suppressed ? "Restore invitation" : "Save duplicate decision"}
      </button>
      </>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </form>
  </details>;
}
