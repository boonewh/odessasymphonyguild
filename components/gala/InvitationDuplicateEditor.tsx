"use client";
import { useState, type FormEvent } from "react";
import { duplicateCandidates, invitationKey, invitationLabels, isSuppressed, type InvitationRow } from "@/lib/gala/invitations";
import styles from "./PaymentLab.module.css";

export default function InvitationDuplicateEditor({ row, rows, saved, started }: {
  row: InvitationRow; rows: InvitationRow[]; saved: () => Promise<void>; started: () => void;
}) {
  const candidates = duplicateCandidates(row, rows);
  const options = rows.filter(other => !isSuppressed(other) && invitationKey(other) !== invitationKey(row));
  const [targetKey, setTargetKey] = useState(candidates.length === 1 ? invitationKey(candidates[0]) : "");
  const [decision, setDecision] = useState("separate");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const suppressed = isSuppressed(row);
  const retained = rows.find(other => other.request_id === row.duplicate_request_id && other.recipient_index === row.duplicate_recipient_index);
  const linked = rows.filter(other => other.duplicate_request_id === row.request_id && other.duplicate_recipient_index === row.recipient_index);
  const target = options.find(other => invitationKey(other) === targetKey);
  const maySuppress = row.status !== "mailed" && linked.length === 0;

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

  return <details>
    <summary>{suppressed ? "Review / restore suppressed entry" : "Review duplicates"}</summary>
    <form className={styles.assignmentForm} onSubmit={submit} aria-label={`Duplicate review for ${row.recipient.name}`}>
      {suppressed ? <p>Excluded from mailing. Kept entry: {retained?.recipient.name || "See request reference"}
        {retained && <> — {retained.recipient.address}, {retained.recipient.city}</>}
        <small>{row.duplicate_request_id} · recipient {(row.duplicate_recipient_index ?? 0) + 1}</small>
        Restoring returns this entry to Needs preparation and requires another duplicate review.</p> : <>
        <p>{candidates.length} possible matches need review. You can also select another entry for spelling differences.</p>
        <label>Other invitation<select value={targetKey} disabled={busy || !!error} onChange={e => setTargetKey(e.target.value)}>
          <option value="">Select another recipient</option>
          {options.map(other => <option key={invitationKey(other)} value={invitationKey(other)}>
            {other.recipient.name} — {other.recipient.address} {other.recipient.address2} · {other.request_id.slice(0,8)} / {other.recipient_index+1}
          </option>)}
        </select></label>
        {target && <p>Other entry: {target.recipient.name}, {target.recipient.address} {target.recipient.address2}, {target.recipient.city}, {target.recipient.state} {target.recipient.zip}.
          Requested by {target.contact.name}. Status: {invitationLabels[target.status]}.</p>}
        <label>Decision<select value={decision} disabled={busy || !!error} onChange={e => setDecision(e.target.value)}>
          <option value="separate">Keep these as separate invitations</option>
          <option value="suppress" disabled={!maySuppress}>Suppress this entry; keep the selected invitation</option>
        </select></label>
        {!maySuppress && <p>Mailed entries and entries kept for other duplicates cannot be suppressed.</p>}
        {decision === "suppress" && <p>This entry will leave the mailing list. Remove any prepared envelope or label. The selected invitation is unchanged.</p>}
        {!!row.separate_from?.length && <p>Previously reviewed as separate from {row.separate_from.length} other entries at the current addresses.</p>}
      </>}
      <label>Duplicate decision reason<input required minLength={3} maxLength={300} value={reason} disabled={busy || !!error} onChange={e => setReason(e.target.value)} /></label>
      <button disabled={busy || !!error || reason.trim().length < 3 || (!suppressed && (!target || (decision === "suppress" && !maySuppress)))}>
        {busy ? "Saving…" : suppressed ? "Restore invitation" : "Save duplicate decision"}
      </button>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </form>
  </details>;
}
