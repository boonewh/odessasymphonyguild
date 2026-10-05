"use client";

import { useState, type FormEvent } from "react";
import { invitationAddressUpdate, type InvitationRow } from "@/lib/gala/invitations";
import type { Recipient } from "@/lib/gala/model";
import styles from "./PaymentLab.module.css";

const fields: { key: keyof Recipient; label: string; max: number; min?: number; pattern?: string }[] = [
  { key: "name", label: "Envelope name", min: 2, max: 120 },
  { key: "address", label: "Street address", min: 3, max: 200 },
  { key: "address2", label: "Address line 2 (optional)", max: 120 },
  { key: "city", label: "City", min: 2, max: 100 },
  { key: "state", label: "State (two letters)", max: 2, pattern: "[A-Za-z]{2}" },
  { key: "zip", label: "ZIP code", max: 10, pattern: "[0-9]{5}(-[0-9]{4})?" },
];

export default function InvitationAddressEditor({ row, saved, started }: {
  row: InvitationRow; saved: () => Promise<void>; started: () => void;
}) {
  const [recipient, setRecipient] = useState(row.recipient);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const changed = fields.some(({ key }) => recipient[key].trim() !== row.recipient[key]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || uncertain || !changed) return;
    const parsed = invitationAddressUpdate.safeParse({
      action: "address", requestId: row.request_id, recipientIndex: row.recipient_index,
      revision: row.revision, recipient, reason,
    });
    if (!parsed.success) {
      setError("Check the address fields and enter a correction reason of at least three characters.");
      return;
    }
    setBusy(true); setError(""); started();
    try {
      const response = await fetch("/api/gala/invitations", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data),
      });
      if (!response.ok) throw new Error(response.status === 401
        ? "Session expired. Reload and unlock the local admin."
        : "Address change not confirmed. Refresh invitations before retrying.");
      await saved();
    } catch (e) {
      setUncertain(true);
      setError((e as Error).message || "Address change not confirmed. Refresh invitations before retrying.");
    } finally { setBusy(false); }
  }

  if (row.status === "mailed") return <p className={styles.note}>
    Mailed addresses are locked to preserve what was sent. Correct the mailing status first only if it was recorded incorrectly.
  </p>;

  return <details>
    <summary>Edit recipient / address</summary>
    <form onSubmit={submit} className={styles.assignmentForm} aria-label={`Edit address for ${row.recipient.name}`}>
      {fields.map(({ key, label, max, min, pattern }) => <label key={key}>{label}
        <input value={recipient[key]} required={key !== "address2"} maxLength={max} minLength={min}
          pattern={pattern} disabled={busy || uncertain} autoComplete="off"
          onChange={event => setRecipient(current => ({ ...current, [key]: event.target.value }))} />
      </label>)}
      <label>Address correction reason
        <input value={reason} required minLength={3} maxLength={300} disabled={busy || uncertain}
          onChange={event => setReason(event.target.value)} />
      </label>
      {row.status === "prepared" && <p className={styles.note}>
        Saving a changed address returns this invitation to Needs preparation. Replace the old envelope or label before preparing it again.
      </p>}
      <p className={styles.note}>The previous address and your reason are recorded. This does not verify postal deliverability.</p>
      <button disabled={busy || uncertain || !changed || reason.trim().length < 3}>
        {busy ? "Saving…" : "Save address correction"}
      </button>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </form>
  </details>;
}
