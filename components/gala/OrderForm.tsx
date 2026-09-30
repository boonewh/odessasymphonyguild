"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { ZodError } from "zod";
import { TABLES, contactSchema, giftsSchema, recipientsSchema, quotePurchase, quoteGifts, money,
  type Product, type Gift, type Recipient, type DemoOrder } from "@/lib/gala/model";
import { useDemoOrders } from "@/lib/gala/use-demo-orders";
import styles from "./gala-sales.module.css";

type Kind = DemoOrder["kind"];
const blankGift = (): Gift => ({ student: "", grade: "9", roses: 1, cookies: 0 });
const blankRecipient = (): Recipient => ({ name: "", address: "", address2: "", city: "", state: "TX", zip: "" });
function Field({ label, name, value, onChange, type = "text", required = true, maxLength = 120, disabled = false }: {
  label: string; name: string; value: string; onChange: (value: string) => void;
  type?: string; required?: boolean; maxLength?: number; disabled?: boolean;
}) {
  return <label className={styles.field}>{label}<input disabled={disabled} name={name} type={type} value={value} required={required} maxLength={maxLength}
    onChange={(event) => onChange(event.target.value)} /></label>;
}
function Quantity({ label, name, value, max, min = 0, onChange }: {
  label: string; name: string; value: number; max: number; min?: number; onChange: (value: number) => void;
}) {
  return <label className={styles.field}>{label}<select name={name} value={value} onChange={(event) => onChange(Number(event.target.value))}>
    {Array.from({ length: max - min + 1 }, (_, index) => index + min).map((count) => <option key={count} value={count}>{count}</option>)}
  </select></label>;
}

export default function OrderForm({ kind, clientReview = false }: { kind: Kind; clientReview?: boolean }) {
  return clientReview ? <OrderFormContent kind={kind} clientReview /> : <LocalOrderForm kind={kind} />;
}
function LocalOrderForm({ kind }: { kind: Kind }) {
  const store = useDemoOrders();
  return <OrderFormContent kind={kind} store={store} />;
}
function OrderFormContent({ kind, store, clientReview = false }: { kind: Kind; store?: ReturnType<typeof useDemoOrders>; clientReview?: boolean }) {
  const [product, setProduct] = useState<Product>("gold");
  const [quantity, setQuantity] = useState(1);
  const [extraSeats, setExtraSeats] = useState(0);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [gifts, setGifts] = useState<Gift[]>([blankGift()]);
  const [recipients, setRecipients] = useState<Recipient[]>([blankRecipient()]);
  const [agreed, setAgreed] = useState(false);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const table = TABLES.find((item) => item.id === product);
  const purchase = { product, quantity: table ? 1 : quantity, extraSeats: table ? extraSeats : 0 };
  const quote = quotePurchase(purchase);
  const total = kind === "tables" ? quote.total : kind === "gifts" ? gifts.reduce((sum, gift) => sum + (gift.roses + gift.cookies) * 1000, 0) : 0;
  function selectProduct(next: Product) { setProduct(next); setQuantity(1); setExtraSeats(0); }
  function changeGift(index: number, patch: Partial<Gift>) { setGifts((items) => items.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  function changeRecipient(index: number, patch: Partial<Recipient>) { setRecipients((items) => items.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (clientReview || !store || saved) return;
    try {
      const buyer = contactSchema.parse(contact);
      if (kind !== "invitations" && !agreed) throw new Error("Please acknowledge the no-refund policy.");
      const order: DemoOrder = {
        id: `PREVIEW-${crypto.randomUUID()}`, demo: true, kind, contact: buyer,
        createdAt: new Date().toISOString(), tableAssignment: "",
        status: kind === "invitations" ? "requested" : "awaiting_payment", total: 0, description: "",
      };
      if (kind === "tables") { order.purchase = purchase; order.total = quote.total; order.description = quote.description; }
      if (kind === "gifts") {
        order.gifts = giftsSchema.parse(gifts); order.total = quoteGifts(order.gifts);
        order.description = `Celebration gifts for ${gifts.length} student${gifts.length === 1 ? "" : "s"}`;
      }
      if (kind === "invitations") {
        order.recipients = recipientsSchema.parse(recipients);
        order.description = `${recipients.length} invitation recipient${recipients.length === 1 ? "" : "s"}`;
      }
      store.add(order); setSaved(order.id);
    } catch (err) {
      setError(err instanceof ZodError ? err.issues[0].message : err instanceof Error ? err.message : "The preview order could not be saved.");
    }
  }
  return <form onSubmit={submit}>
    <fieldset disabled={!!saved} className={styles.formSection}>
      <legend className="sr-only">{kind === "tables" ? "Choose your table or tickets" : kind === "gifts" ? "Choose your celebration gifts" : "Invitation details"}</legend>
      {kind === "tables" && <>
        <h2 className={styles.flyerSectionTitle}>Table options</h2>
        <div className={styles.tiers}>{TABLES.map((tier) => <article className={styles.tier} key={tier.id}>
          <div><p className={styles.tierOrnament} aria-hidden="true">❦</p><h3>{tier.name}</h3><p className={styles.price}>{money(tier.price)}</p>
            <p className={styles.tagline}>{tier.description}</p>
            <ul className={styles.benefits} role="list">{tier.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
            <p className={styles.extra}>Add up to 2 extra seats at {money(tier.extra)} each.</p></div>
          <label className={styles.choose}><input type="radio" name="product" value={tier.id} checked={product === tier.id} onChange={() => selectProduct(tier.id)} />Choose {tier.name.toLowerCase()}</label>
        </article>)}</div>
        <h2 className={styles.flyerSectionTitle}>Individual ticket options</h2>
        <div className={styles.tickets}>
          <article className={styles.ticket}><h3>Couples ticket</h3><p className={styles.price}>{money(30000)}</p><p>Open seating for 2 adults.</p>
            <label className={styles.choose}><input name="product" type="radio" checked={product === "couples"} onChange={() => selectProduct("couples")} />Choose couples tickets</label></article>
          <article className={styles.ticket}><h3>Student date ticket</h3><p className={styles.price}>{money(10000)}</p><p>Admission for 1 student.</p>
            <label className={styles.choose}><input name="product" type="radio" checked={product === "student-date"} onChange={() => selectProduct("student-date")} />Choose student date tickets</label></article>
        </div>
        <p className={styles.ribbon}>Belle &amp; Beau tickets are included with their membership fees.</p>
      </>}
      {kind === "gifts" && <>
        <div className={styles.giftArtwork}><Image src="/images/gala-2027-gifts-art.png" alt="" width={2172} height={724} sizes="(max-width: 700px) 90vw, 960px" /></div>
        <div className={styles.giftIntro}>
          <div><h2>Single roses</h2><p>A rose for your Belle or Beau.</p><p className={styles.price}>{money(1000)} <small>each</small></p></div>
          <div><h2>Chocolate chip cookies</h2><p>Two cookies in every bag.</p><p className={styles.price}>{money(1000)} <small>per bag</small></p></div>
        </div>
        <p className={styles.ribbon}>Order by January 29. No late orders; flowers and cookies will not be sold at the Ball.</p>
      </>}
      {kind === "invitations" && <p className={styles.ribbon}>The Guild will address and mail your invitations for you. An invitation does not reserve a seat.</p>}
      <h2 id="gala-order-details" className={styles.flyerSectionTitle}>{kind === "invitations" ? "Your invitation information" : "Your order details"}</h2>
      <div className={styles.orderLayout}>
        <div>
          {kind === "tables" && <fieldset className={styles.formSection}><legend>Your selection</legend>
            {table ? <Quantity name="extraSeats" label="Additional seats" value={extraSeats} max={2} onChange={setExtraSeats} />
              : <Quantity name="quantity" label={product === "couples" ? "Number of couples tickets" : "Number of student date tickets"} value={quantity} min={1} max={10} onChange={setQuantity} />}
            <p className={styles.fine}>Table location is assigned by the Guild. Each table includes eight purchased seats; Belle and Beau attendance does not reduce that number.</p>
          </fieldset>}
          {kind === "gifts" && <fieldset className={styles.formSection}><legend>Celebrate your students</legend>
            {gifts.map((gift, index) => <div key={index} className={styles.repeat}>
              <div className={styles.repeatHead}><h3>Student {index + 1}</h3>{gifts.length > 1 && <button type="button" className={styles.secondary} onClick={() => setGifts(gifts.filter((_, i) => i !== index))}>Remove student {index + 1}</button>}</div>
              <div className={styles.fields}>
                <Field disabled={clientReview} label="Student’s name" name={`student-${index}`} value={gift.student} onChange={(student) => changeGift(index, { student })} />
                <label className={styles.field}>Grade<select name={`grade-${index}`} value={gift.grade} onChange={(event) => changeGift(index, { grade: event.target.value as Gift["grade"] })}>{[9, 10, 11, 12].map((grade) => <option key={grade}>{grade}</option>)}</select></label>
                <Quantity name={`roses-${index}`} label="Roses · $10 each" value={gift.roses} max={50} onChange={(roses) => changeGift(index, { roses })} />
                <Quantity name={`cookies-${index}`} label="Cookie bags · $10 each" value={gift.cookies} max={50} onChange={(cookies) => changeGift(index, { cookies })} />
              </div>
            </div>)}
            <button type="button" className={styles.secondary} disabled={gifts.length >= 20} onClick={() => setGifts([...gifts, blankGift()])}>Add another student</button>
          </fieldset>}
          {kind === "invitations" && <fieldset disabled={clientReview} className={styles.formSection}><legend>Who would you like to invite?</legend>
            {recipients.map((recipient, index) => <div key={index} className={styles.repeat}>
              <div className={styles.repeatHead}><h3>Recipient {index + 1}</h3>{recipients.length > 1 && <button type="button" className={styles.secondary} onClick={() => setRecipients(recipients.filter((_, i) => i !== index))}>Remove recipient {index + 1}</button>}</div>
              <div className={styles.fields}>
                <div className={styles.wide}><Field label="Name as it should appear on the envelope" name={`recipient-${index}`} value={recipient.name} onChange={(name) => changeRecipient(index, { name })} /></div>
                <div className={styles.wide}><Field label="Street address" name={`address-${index}`} value={recipient.address} maxLength={200} onChange={(address) => changeRecipient(index, { address })} /></div>
                <div className={styles.wide}><Field label="Apartment, suite, etc. (optional)" name={`address2-${index}`} value={recipient.address2} required={false} onChange={(address2) => changeRecipient(index, { address2 })} /></div>
                <Field label="City" name={`city-${index}`} value={recipient.city} onChange={(city) => changeRecipient(index, { city })} />
                <Field label="State abbreviation" name={`state-${index}`} value={recipient.state} maxLength={2} onChange={(state) => changeRecipient(index, { state })} />
                <Field label="ZIP code" name={`zip-${index}`} value={recipient.zip} maxLength={10} onChange={(zip) => changeRecipient(index, { zip })} />
              </div>
            </div>)}
            <button type="button" className={styles.secondary} disabled={recipients.length >= 20} onClick={() => setRecipients([...recipients, blankRecipient()])}>Add another recipient</button>
          </fieldset>}
          <fieldset disabled={clientReview} className={styles.formSection}><legend>Your information</legend><div className={styles.fields}>
            <div className={styles.wide}><Field label="Your name" name="buyerName" value={contact.name} onChange={(name) => setContact({ ...contact, name })} /></div>
            <Field label="Email address" name="email" type="email" value={contact.email} maxLength={254} onChange={(email) => setContact({ ...contact, email })} />
            <Field label="Phone number" name="phone" type="tel" value={contact.phone} maxLength={30} onChange={(phone) => setContact({ ...contact, phone })} />
          </div></fieldset>
        </div>
        <aside className={styles.summary} aria-label="Order summary">
          <h2>{kind === "invitations" ? "Your invitation request" : "Your evening, your way"}</h2>
          <dl>
            {kind === "tables" && <><div><dt>{table?.name ?? (product === "couples" ? "Couples tickets" : "Student date tickets")}</dt><dd>{table ? "1 table" : `${quantity} ticket${quantity === 1 ? "" : "s"}`}</dd></div><div><dt>Purchased seats</dt><dd>{quote.seats}</dd></div></>}
            {kind === "gifts" && <><div><dt>Roses</dt><dd>{gifts.reduce((sum, gift) => sum + gift.roses, 0)}</dd></div><div><dt>Cookie bags</dt><dd>{gifts.reduce((sum, gift) => sum + gift.cookies, 0)}</dd></div></>}
            {kind === "invitations" ? <div><dt>Recipients</dt><dd>{recipients.length}</dd></div> : <div className={styles.total}><dt>Total</dt><dd>{money(total)}</dd></div>}
          </dl>
          {kind !== "invitations" && <label className={styles.agreement}><input disabled={clientReview} name="refundAcknowledgment" type="checkbox" required checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /><span>I understand that all sales are final and no refunds are offered.</span></label>}
          <button type="submit" className={styles.primary} disabled={clientReview || !store?.ready || !!saved}>{clientReview ? "Not open yet" : kind === "invitations" ? "Save preview request" : "Create preview order"}</button>
          <p className={styles.fine}>{clientReview ? "Design review only. No information is saved or submitted, and no payment can be made." : kind === "invitations" ? "Preview only. No request is sent to the Guild and no invitation is mailed." : "Preview only. Stripe is not connected. This creates an unpaid sample order for review in the preview admin."}</p>
          {kind === "tables" && <p className={styles.fine}>{clientReview ? "Table availability will be announced when sales open." : "Development inventory: 20 of each table tier. Actual availability has not been confirmed. Sales cannot launch with these placeholders."}</p>}
          {kind === "gifts" && <p className={styles.fine}>The exact deadline time is awaiting confirmation. This preview does not enforce a sales cutoff.</p>}
        </aside>
      </div>
    </fieldset>
    {(error || store?.error) && <p role="alert" className={styles.error}>{error || store?.error}</p>}
    {saved && <div role="status" className={styles.success}><strong>Saved in this browser for review.</strong><p>{kind === "invitations" ? "The sample request is ready to review." : "No payment has been taken. The sample order is awaiting a simulated payment."}</p>
      <Link href="/gala/preview/admin">Open the preview admin</Link>
      <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => { setSaved(""); setAgreed(false); setContact({ name: "", email: "", phone: "" }); }}>Start another preview order</button></div>
    </div>}
  </form>;
}
