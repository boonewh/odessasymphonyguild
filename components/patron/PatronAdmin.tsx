"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Patron } from "@/lib/patron/model";
import ContactFields from "./ContactFields";
import styles from "./PatronForm.module.css";

export default function PatronAdmin() {
  const [patrons, setPatrons] = useState<Patron[]>([]), [editing, setEditing] = useState<Patron | null>(null);
  const [query, setQuery] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [error, setError] = useState(""), [loadError, setLoadError] = useState(""), [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
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
    const contact = { name: data.get("name"), email: data.get("email"), phone: data.get("phone"), published: data.get("published") === "on" };
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/patrons", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { ...contact, id: editing.id } : { ...contact, requestId: requestId.current }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The patron could not be saved.");
      setNotice(editing ? "Changes saved. The roster below shows the updated entry." : "Entry received. If this name and email were already registered, the existing entry has been kept.");
      setEditing(null); setRevision(value => value + 1); requestId.current = "";
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "The patron could not be saved."); }
    finally { setBusy(false); }
  }
  const visible = patrons.filter(patron => `${patron.name} ${patron.email} ${patron.phone}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    {notice && <p className={`${styles.success} mb-6`} role="status">{notice}</p>}
    <div className={styles.adminLayout}>
      <section ref={editor} tabIndex={-1} className={styles.editor} aria-labelledby="patron-editor-title">
        <h2 id="patron-editor-title">{editing ? "Edit patron" : "Add a check patron"}</h2>
        <p className={`${styles.hint} mb-6`}>{editing ? "Correct contact details or change whether this name is shown publicly." : "A name is all you need. Add contact details if you have them."}</p>
        <form key={revision} className={styles.form} onSubmit={save} onChange={() => { requestId.current = ""; }}>
          <fieldset disabled={busy} className={styles.fields}>
            <legend className="sr-only">Patron details</legend>
            <ContactFields prefix="admin-patron" values={editing || undefined} />
            <label className={styles.consent} htmlFor="admin-patron-published">
              <input id="admin-patron-published" name="published" type="checkbox" defaultChecked={editing?.published ?? true} />
              <span>Show this name on the Patron page</span>
            </label>
          </fieldset>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button type="submit" disabled={busy} className={styles.button}>{busy ? "Saving…" : editing ? "Save changes" : "Add check patron"}</button>
            {editing && <button type="button" disabled={busy} className={styles.secondary} onClick={() => choose(null)}>Cancel</button>}
          </div>
        </form>
      </section>
      <section className={styles.roster} aria-labelledby="patron-roster-title">
        <div className={styles.toolbar}>
          <h2 id="patron-roster-title">Patron roster</h2>
          <button type="button" className={styles.secondary} disabled={loading || busy} onClick={() => void load()}>Refresh roster</button>
        </div>
        <div className={styles.field}>
          <label htmlFor="patron-search">Find a patron</label>
          <input id="patron-search" name="search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, email, or phone" />
        </div>
        {loadError && <p role="alert" className={`${styles.error} mt-6`}>{loadError}</p>}
        {loading ? <p className="mt-6" role="status">Loading patrons…</p> : !loadError && <>
          <p className={`${styles.hint} mt-4`}>{patrons.length} {patrons.length === 1 ? "patron" : "patrons"} · {patrons.filter(patron => patron.published).length} shown publicly</p>
          {visible.length === 0 ? <p className="mt-6">{query ? "No patrons match your search." : "No patrons yet. Online signups and check entries will appear here."}</p> :
            <div className={styles.table}><table>
              <thead><tr><th scope="col">Patron</th><th scope="col">Entry</th><th scope="col">Public name</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>{visible.map(patron => <tr key={patron.id}>
                <td>{patron.name}<div className={styles.contact}>{patron.email || "No email"}<br />{patron.phone || "No phone"}</div></td>
                <td>{patron.source === "check" ? "Check" : "Online signup"}</td>
                <td className={styles.status}>{patron.published ? "Shown" : "Hidden"}</td>
                <td><button type="button" disabled={busy} className={styles.secondary} aria-label={`Edit ${patron.name}`} onClick={() => choose(patron)}>Edit</button></td>
              </tr>)}</tbody>
            </table></div>}
        </>}
      </section>
    </div>
  </>;
}
