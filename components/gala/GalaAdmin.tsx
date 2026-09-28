"use client";

import { useState } from "react";
import { TABLES, RELEASE, money, quotePurchase, remainingTables, STATUS_LABELS, type DemoOrder, type OrderStatus } from "@/lib/gala/model";
import { useDemoOrders } from "@/lib/gala/use-demo-orders";
import styles from "./gala-sales.module.css";

export default function GalaAdmin() {
  const store = useDemoOrders();
  const [kind, setKind] = useState<DemoOrder["kind"]>("tables");
  const [filter, setFilter] = useState("paid");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [assignment, setAssignment] = useState("");
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const order = store.orders.find((item) => item.id === selected);
  const visible = store.orders.filter((item) => item.kind === kind && (filter === "all" || item.status === filter) &&
    `${item.contact.name} ${item.contact.email} ${item.description}`.toLowerCase().includes(query.toLowerCase()));
  const paid = store.orders.filter((item) => item.status === "paid");
  function run(action: () => void) { try { action(); setError(""); } catch (err) { setError(err instanceof Error ? err.message : "Could not update the preview."); } }
  function changeStatus(status: OrderStatus) { if (order) run(() => store.update(order.id, status)); }
  return <div className={styles.admin}>
    <div className={styles.ribbon}><strong>Launch blocked.</strong> Inventory is {RELEASE.inventoryConfirmed ? "confirmed" : "unconfirmed"}. Stripe testing, accounting review, and launch approval are still outstanding.</div>
    <dl className={styles.stats}>
      <div><dt>Paid sample orders</dt><dd>{paid.length}</dd></div>
      <div><dt>Simulated revenue</dt><dd>{money(paid.reduce((sum, item) => sum + item.total, 0))}</dd></div>
      <div><dt>Awaiting payment</dt><dd>{store.orders.filter((item) => item.status === "awaiting_payment").length}</dd></div>
      <div><dt>Expired attempts</dt><dd>{store.orders.filter((item) => item.status === "expired").length}</dd></div>
    </dl>
    <h2 className={styles.sectionTitle}>Table inventory · development only</h2>
    <div className={styles.tableScroll}><div className={styles.tableInner}><table className={styles.table}>
      <caption className="sr-only">Placeholder table inventory, not approved for sales</caption>
      <thead><tr><th scope="col">Tier</th><th scope="col">Placeholder total</th><th scope="col">Held</th><th scope="col">Sold</th><th scope="col">Available in preview</th></tr></thead>
      <tbody>{TABLES.map((tier) => <tr key={tier.id}><th scope="row">{tier.name}</th><td>20 · unconfirmed</td>
        <td>{store.orders.filter((item) => item.purchase?.product === tier.id && item.status === "awaiting_payment").length}</td>
        <td>{paid.filter((item) => item.purchase?.product === tier.id).length}</td><td>{remainingTables(store.orders, tier.id)}</td></tr>)}</tbody>
    </table></div></div>
    <p className={styles.fine}>Ticket capacity is not set. This browser-only prototype cannot prove concurrent inventory safety. That requires the database and Stripe integration tests.</p>
    <div className={styles.toolbar} aria-label="Order categories">
      {([["tables", "Tables & tickets"], ["gifts", "Gifts & fulfillment"], ["invitations", "Invitation mailing"]] as const).map(([value, label]) =>
        <button key={value} type="button" className={styles.secondary} aria-pressed={kind === value} onClick={() => { setKind(value); setFilter(value === "invitations" ? "all" : "paid"); setSelected(""); }}>{label}</button>)}
    </div>
    <div className={styles.toolbar}>
      <input type="search" className={styles.search} name="orderSearch" aria-label="Search orders" placeholder="Search buyer or purchase" value={query} onChange={(event) => setQuery(event.target.value)} />
      <label className={styles.field}><span className="sr-only">Order status</span><select name="orderStatus" value={filter} onChange={(event) => setFilter(event.target.value)}>
        <option value="all">All statuses</option>
        {(kind === "invitations" ? ["requested", "prepared", "mailed"] : ["paid", "awaiting_payment", "expired"]).map((status) => <option key={status} value={status}>{STATUS_LABELS[status as OrderStatus]}</option>)}
      </select></label>
    </div>
    {!store.ready && !store.error ? <p className={styles.empty}>Loading local preview orders…</p> : visible.length === 0 ?
      <p className={styles.empty}>No {filter === "all" ? "" : STATUS_LABELS[filter as OrderStatus]?.toLowerCase()} sample orders here yet. Create one on an ordering page. New purchases appear under “Awaiting payment.”</p> :
      <div className={styles.tableScroll}><div className={styles.tableInner}><table className={styles.table}>
        <caption className="sr-only">Local sample orders</caption>
        <thead><tr><th scope="col">Buyer</th><th scope="col">Purchase / request</th><th scope="col">Total</th><th scope="col">Status</th><th scope="col">Accounting</th><th scope="col">Details</th></tr></thead>
        <tbody>{visible.map((item) => <tr key={item.id}>
          <td>{item.contact.name}<small>{new Date(item.createdAt).toLocaleDateString("en-US")}</small></td>
          <td>{item.description}{item.purchase && <small>{quotePurchase(item.purchase).seats} purchased seats{item.tableAssignment ? ` · ${item.tableAssignment}` : ""}</small>}</td>
          <td>{item.kind === "invitations" ? "—" : money(item.total)}</td>
          <td><span className={styles.badge} data-status={item.status}>{STATUS_LABELS[item.status]}</span></td>
          <td>{item.status === "paid" ? "Preview — not synced" : "Not sent"}</td>
          <td><button type="button" className={styles.secondary} aria-label={`View ${item.contact.name}'s order`} onClick={() => { setSelected(item.id); setAssignment(item.tableAssignment); }}>View</button></td>
        </tr>)}</tbody>
      </table></div></div>}
    {order && <section className={styles.detail} aria-label="Selected order details">
      <h2>{order.contact.name}</h2>
      <p>{order.description} · <strong>{STATUS_LABELS[order.status]}</strong></p>
      <p>{order.contact.email} · {order.contact.phone}</p>
      <p className={styles.fine}>Reference: {order.id}</p>
      {order.gifts && <><h3>Student gifts</h3><ul role="list">{order.gifts.map((gift, i) => <li key={i}>{gift.student}, grade {gift.grade}: {gift.roses} rose(s), {gift.cookies} cookie bag(s)</li>)}</ul><p className={styles.fine}>{order.status === "paid" ? "Included in the simulated paid fulfillment list." : "Unpaid — excluded from fulfillment."}</p></>}
      {order.recipients && <><h3>Mailing recipients</h3><ul role="list">{order.recipients.map((recipient, i) => <li key={i}>{recipient.name}: {recipient.address}{recipient.address2 ? `, ${recipient.address2}` : ""}, {recipient.city}, {recipient.state} {recipient.zip}</li>)}</ul></>}
      {order.purchase && TABLES.some((tier) => tier.id === order.purchase?.product) && order.status === "paid" && <div className={styles.actions}>
        <label className={styles.field}>Assigned table (optional)<input name="tableAssignment" value={assignment} maxLength={100} onChange={(event) => setAssignment(event.target.value)} /></label>
        <button type="button" className={styles.secondary} onClick={() => run(() => store.assign(order.id, assignment.trim()))}>Save assignment</button>
      </div>}
      <div className={styles.actions}>
        {order.status === "awaiting_payment" && <><button type="button" className={styles.secondary} onClick={() => changeStatus("paid")}>Simulate successful payment</button><button type="button" className={styles.secondary} onClick={() => changeStatus("expired")}>Simulate verified expiry</button></>}
        {order.status === "requested" && <button type="button" className={styles.secondary} onClick={() => changeStatus("prepared")}>Simulate prepared invitations</button>}
        {order.status === "prepared" && <button type="button" className={styles.secondary} onClick={() => changeStatus("mailed")}>Simulate mailed invitations</button>}
        <button type="button" className={styles.secondary} onClick={() => setSelected("")}>Close details</button>
      </div>
      {order.status === "awaiting_payment" && <p className={styles.fine}>These controls only exercise the preview. In the finished system, verified Stripe events determine payment and expiry; closing a browser or reaching a timer is not proof that inventory is safe to release.</p>}
      {order.status === "paid" && <p className={styles.fine}>Current policy: all sales final, no refunds. No live financial actions are available in this preview.</p>}
    </section>}
    {(error || store.error) && <p role="alert" className={styles.error}>{error || store.error}</p>}
    <div className={styles.detail}><h2>Local preview data</h2><p>Only fictional entries belong here. This data is stored in this browser and is never sent to the Guild.</p>
      {confirmClear ? <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => run(() => { store.clear(); setSelected(""); setConfirmClear(false); })}>Confirm clear all sample orders</button><button type="button" className={styles.secondary} onClick={() => setConfirmClear(false)}>Keep sample orders</button></div> :
        <button type="button" className={styles.secondary} onClick={() => setConfirmClear(true)}>Clear local sample orders</button>}
    </div>
  </div>;
}
