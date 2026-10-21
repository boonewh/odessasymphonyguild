"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Patron } from "@/lib/patron/model";
import ContactFields from "./ContactFields";
import styles from "./PatronForm.module.css";

const needsReview = (patron: Patron) => patron.source === "online" && !patron.approved_at;

export default function PatronAdmin() {
  const [patrons, setPatrons] = useState<Patron[]>([]), [editing, setEditing] = useState<Patron | null>(null);
  const [query, setQuery] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [error, setError] = useState(""), [loadError, setLoadError] = useState(""), [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [reviewOnly, setReviewOnly] = useState(false);
  const reviewing = editing !== null && needsReview(editing);
  const pendingCount = patrons.filter(needsReview).length;
  const requestId = useRef("");
  const editor = useRef<HTMLElement>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setLoadError("");
    try {
      const response = await fetch("/api/admin/patrons", { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The roster could not be loaded.");
      setPatrons(data.patrons);
    } catch (e) {
      if (!signal?.aborted) setLoadError(e instanceof Error ? e.message : "The roster could not be loaded.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);

  function choose(patron: Patron | null) {
    setEditing(patron); setError(""); setNotice(""); requestId.current = ""; setRevision(value => value + 1);
    editor.current?.scrollIntoView({ behavior: "auto", block: "start" });
    editor.current?.focus();
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget);
    requestId.current ||= crypto.randomUUID();
    const approve = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "approve";
    const contact = { name: data.get("name"), email: data.get("email"), phone: data.get("phone"), published: reviewing ? approve : data.get("published") === "on" };
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/patrons", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { ...contact, id: editing.id } : { ...contact, requestId: requestId.current }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The patron could not be saved.");
      setNotice(reviewing ? (approve ? "Name approved and published in the thank-you section." : "Corrections saved. This signup still needs approval and is not public.") : editing ? "Changes saved. The roster below shows the updated entry." : "Entry received. If this name and email were already registered, the existing entry has been kept.");
      setEditing(null); setRevision(value => value + 1); requestId.current = "";
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "The patron could not be saved."); }
    finally { setBusy(false); }
  }
  const visible = patrons.filter(patron => (!reviewOnly || needsReview(patron)) && `${patron.name} ${patron.email} ${patron.phone}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => Number(needsReview(b)) - Number(needsReview(a)));
  return <>
    {notice && <p className={`${styles.success} mb-6`} role="status">{notice}</p>}
    <div className={styles.adminLayout}>
      <section ref={editor} tabIndex={-1} className={styles.editor} aria-labelledby="patron-editor-title">
        <h2 id="patron-editor-title">{reviewing ? "Review signup" : editing ? "Edit patron" : "Add a check patron"}</h2>
        <p className={`${styles.hint} mb-6`}>{reviewing ? "Check and correct the name below. Saving corrections keeps it private; approve it when it is ready for the thank-you section." : editing ? "Correct contact details or change whether this name is shown publicly." : "A name is all you need. Check the spelling before publishing."}</p>
        <form key={revision} className={styles.form} onSubmit={save} onChange={() => { requestId.current = ""; }}>
          <fieldset disabled={busy} className={styles.fields}>
            <legend className="sr-only">Patron details</legend>
            <ContactFields prefix="admin-patron" values={editing || undefined} />
            {!reviewing && <label className={styles.consent} htmlFor="admin-patron-published">
              <input id="admin-patron-published" name="published" type="checkbox" defaultChecked={editing?.published ?? true} />
              <span>Show this name on the Patron page</span>
            </label>}
          </fieldset>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button type="submit" disabled={busy} className={reviewing ? styles.secondary : styles.button}>{busy ? "Saving…" : reviewing ? "Save corrections" : editing ? "Save changes" : "Add check patron"}</button>
            {reviewing && <button type="submit" value="approve" disabled={busy} className={styles.button}>Approve and publish</button>}
            {editing && <button type="button" disabled={busy} className={styles.secondary} onClick={() => choose(null)}>Cancel</button>}
          </div>
        </form>
      </section>
      <section className={styles.roster} aria-labelledby="patron-roster-title">
        <div className={styles.toolbar}>
          <h2 id="patron-roster-title">Patron roster</h2>
          <button type="button" className={styles.secondary} disabled={loading || busy} onClick={() => void load()}>Refresh roster</button>
        </div>
        <label className={`${styles.consent} mb-6`}>
          <input type="checkbox" checked={reviewOnly} onChange={event => setReviewOnly(event.target.checked)} />
          <span>Needs review ({pendingCount})</span>
        </label>
        <div className={styles.field}>
          <label htmlFor="patron-search">Find a patron</label>
          <input id="patron-search" name="search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, email, or phone" />
        </div>
        {loadError && <p role="alert" className={`${styles.error} mt-6`}>{loadError}</p>}
        {loading ? <p className="mt-6" role="status">Loading patrons…</p> : !loadError && <>
          <p className={`${styles.hint} mt-4`}>{patrons.length} {patrons.length === 1 ? "patron" : "patrons"} · {pendingCount} awaiting review · {patrons.filter(patron => patron.published).length} shown publicly</p>
          {visible.length === 0 ? <p className="mt-6">{query ? "No patrons match your search." : reviewOnly ? "No signups need review." : "No patrons yet. Online signups and check entries will appear here."}</p> :
            <div className={styles.table}><table>
              <thead><tr><th scope="col">Patron</th><th scope="col">Entry</th><th scope="col">Public name</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>{visible.map(patron => <tr key={patron.id}>
                <td>{patron.name}<div className={styles.contact}>{patron.email || "No email"}<br />{patron.phone || "No phone"}</div></td>
                <td>{patron.source === "check" ? "Check" : "Online signup"}</td>
                <td className={styles.status}>{needsReview(patron) ? "Needs review" : patron.published ? "Shown" : "Hidden"}</td>
                <td><button type="button" disabled={busy} className={styles.secondary} aria-label={`${needsReview(patron) ? "Review" : "Edit"} ${patron.name}`} onClick={() => choose(patron)}>{needsReview(patron) ? "Review" : "Edit"}</button></td>
              </tr>)}</tbody>
            </table></div>}
        </>}
      </section>
    </div>
  </>;
}
