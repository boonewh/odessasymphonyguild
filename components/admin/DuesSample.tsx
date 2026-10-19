"use client";
import { useState } from "react";
import styles from "./SharedAdmin.module.css";
// Fictional display-only fixtures. This page must not call membership APIs.
const rows = [
  { name: "Sample Student One", grade: "9", membership: "Freshman", status: "Paid" },
  { name: "Sample Student Two", grade: "10", membership: "Returning", status: "Awaiting payment" },
  { name: "Sample Student Three", grade: "12", membership: "Returning", status: "Paid" },
];
export default function DuesSample() {
  const [query, setQuery] = useState("");
  const visible = rows.filter(row => Object.values(row).join(" ").toLowerCase().includes(query.toLowerCase()));
  return <main className={styles.content}>
    <p className={styles.eyebrow}>Dues · Belles &amp; Beaux</p><h1>Membership roster</h1><p className={styles.intro}>Review membership and payment status.</p>
    <p className={styles.sampleNotice}>Sample roster for testing the shared admin entrance. Live student records and dues actions stay on the existing live site.</p>
    <div className={styles.filter}><label htmlFor="dues-search">Find a sample student</label><input id="dues-search" name="query" type="search" className={styles.search} value={query} onChange={e => setQuery(e.target.value)} /></div>
    <div className={styles.tableScroll} role="region" aria-label="Sample membership roster" tabIndex={0}><table><caption className="sr-only">Fictional students for navigation testing</caption>
      <thead><tr><th scope="col">Student</th><th scope="col">Grade</th><th scope="col">Membership</th><th scope="col">Payment</th></tr></thead>
      <tbody>{visible.map(row => <tr key={row.name}><td>{row.name}</td><td>{row.grade}</td><td>{row.membership}</td><td>{row.status}</td></tr>)}</tbody></table></div>
    {visible.length === 0 && <p role="status">No sample students match that search.</p>}
    <p className={styles.help}>Use Gala in the menu to open the working Gala test tools, or Admin home to choose another section.</p>
  </main>;
}
