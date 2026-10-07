"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { filterAssignments, type TableAssignment, type AssignmentFilter } from "@/lib/gala/assignments";
import styles from "./PaymentLab.module.css";

function AssignmentEditor({ row, saved, started }: { row: TableAssignment; saved: () => Promise<void>; started: () => void }) {
  const [number, setNumber] = useState(row.table_number?.toString() ?? "");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy || uncertain) return;
    setBusy(true); setError(""); started();
    try {
      const response = await fetch("/api/gala/assignments", {method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({orderId:row.id, revision:row.revision, tableNumber:number.trim() === "" ? null : Number(number)})});
      if (!response.ok) throw new Error(response.status === 401 ? "Session expired. Reload and unlock the local admin." : (await response.json()).error);
      await saved();
    } catch (e) { setError((e as Error).message || "Cannot confirm the assignment. Refresh before retrying."); setUncertain(true); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className={styles.assignmentForm}>
    <label>Table number for {row.buyer.name}<input type="number" min="1" max="999" step="1" value={number} disabled={busy || uncertain}
      placeholder="Unassigned" onChange={e => setNumber(e.target.value)} /></label>
    <button disabled={busy || uncertain || number === (row.table_number?.toString() ?? "")}>{busy ? "Saving…" : number.trim() ? "Save assignment" : "Clear assignment"}</button>
    <small>Leave blank to clear; then save.</small>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </form>;
}

export default function TableAssignments() {
  const [rows, setRows] = useState<TableAssignment[] | null>(null), [error, setError] = useState("");
  const [filter, setFilter] = useState<AssignmentFilter>("all"), [generation, setGeneration] = useState(0);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/gala/assignments", {cache:"no-store"});
      if (!response.ok) throw new Error(response.status === 401 ? "Session expired. Reload and unlock the local admin." : (await response.json()).error);
      setRows((await response.json()).assignments); setGeneration(g => g + 1);
    } catch(e) { setError((e as Error).message); throw e; }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void refresh().catch(() => {}); }, [refresh]);
  async function saved() { await refresh(); setNotice("Table assignment saved."); }
  async function download() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/gala/assignments?format=csv&filter=${filter}`, {cache:"no-store"});
      if (!response.ok) throw new Error("Export unavailable. Refresh assignments and try again.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = "gala-2027-development-table-assignments.csv";
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const shown = filterAssignments(rows || [], filter);
  return <section className={styles.panel} aria-label="Table assignments">
    <h2>Table assignments</h2>
    <p className={styles.note}>Assign table numbers to paid table orders. Each table number can be used once across all tiers. These are practice assignments; the event layout is not final. Individual tickets and Belles &amp; Beaux seating are managed separately.</p>
    <div className={styles.tools}>
      <label>Assignment status<select value={filter} onChange={e=>setFilter(e.target.value as AssignmentFilter)}>
        <option value="all">All paid tables</option><option value="unassigned">Needs assignment</option><option value="assigned">Assigned tables</option>
      </select></label>
      <button disabled={busy} onClick={()=>{setNotice("");void refresh().catch(()=>{});}}>Refresh assignments</button>
      <button disabled={busy || !rows || !!error} onClick={()=>void download()}>Export this view (CSV)</button>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.success}>{notice}</p>}
    {rows && <p>{rows.length} paid tables · {rows.filter(r=>r.table_number === null).length} need assignment. Export includes all matching paid tables, not just the latest 100 orders.</p>}
    {!rows ? <p>{busy ? "Loading assignments…" : "Assignments unavailable."}</p> : shown.length === 0 ? <p>No paid tables match this view.</p> :
      <div className={`${styles.table} ${styles.assignmentTable}`}><table><thead><tr><th>Buyer / order</th><th>Tier</th><th>Purchased seats</th><th>Current table</th><th>Assign or change</th></tr></thead>
        <tbody>{shown.map(row=><tr key={row.id}><td data-label="Buyer / order">{row.buyer.name}<small>{row.buyer.email}</small><details><summary>Order reference</summary><small>{row.id}</small></details></td>
          <td data-label="Tier" style={{textTransform:"capitalize"}}>{row.tier}</td><td data-label="Purchased seats">{row.seats}</td><td data-label="Current table">{row.table_number ?? "Unassigned"}</td>
          <td data-label="Assign or change"><AssignmentEditor key={`${row.id}-${row.revision}-${generation}`} row={row} saved={saved} started={()=>setNotice("")}/></td></tr>)}</tbody></table></div>}
  </section>;
}
