"use client";
import { useLiveGala } from "./GalaRuntime";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ZodError } from "zod";
import { CART_EVENT, SAME_TAB_NOTICE, addToCart, cartCheckout, cartTotal, emptyCart, type CartDraft, type CartAddition } from "@/lib/gala/cart";
import { CHECKOUT_REFERENCE_KEY, readShopping, saveCart } from "@/lib/gala/cart-storage";
import { checkoutRequest, type CheckoutRequest } from "@/lib/gala/checkout-request";
import { FLYER_ATTEMPT_KEY, checkoutUrl } from "@/lib/gala/checkout-attempt";
import { quotePurchase, money, TABLES } from "@/lib/gala/model";
import { OrderFormContent } from "./OrderForm";
import { SandboxOrderStatus } from "./SandboxCheckout";
import styles from "./gala-sales.module.css";

const message = (e: unknown) => e instanceof ZodError ? e.issues[0].message : e instanceof Error ? e.message : "Your cart could not be saved. Please try again.";
export function cartChanged() { window.dispatchEvent(new Event(CART_EVENT)); }
function useCart() {
  const [cart, setCart] = useState<CartDraft>(emptyCart);
  const [reference, setReference] = useState<string | null>(null);
  const [ready, setReady] = useState(false), [error, setError] = useState("");
  const refresh = useCallback(() => {
    try { const saved = readShopping(sessionStorage); setCart(saved.cart); setReference(saved.reference); setReady(true); }
    catch { setReady(false); setError("Your saved cart could not be read. Contact the Guild to check for an unfinished order before starting another purchase."); }
  }, []);
  useEffect(() => { refresh(); window.addEventListener(CART_EVENT, refresh); window.addEventListener("pageshow", refresh);
    return () => { window.removeEventListener(CART_EVENT, refresh); window.removeEventListener("pageshow", refresh); }; }, [refresh]);
  function update(next: CartDraft) {
    try { saveCart(sessionStorage, next); setError(""); cartChanged(); return true; }
    catch(e) { setError(message(e)); return false; }
  }
  return { cart, reference, ready, error, setError, update, refresh };
}
export function CartLink({ summary = false, current = false }: { summary?: boolean; current?: boolean }) {
  const { cart, reference, ready } = useCart();
  return <Link href="/gala/cart" className={summary ? styles.cartNavLink : undefined} aria-current={current ? "page" : undefined}>
    {reference ? "Your checkout" : <>Cart{ready && ` (${cart.purchases.length + cart.gifts.length})`}{summary && ready && ` · ${money(cartTotal(cart))}`}</>}
  </Link>;
}
function ContinueShopping() {
  return <div className={styles.actions}><Link href="/gala/tables">Add tables or tickets</Link><Link href="/gala/gifts">Add celebration gifts</Link></div>;
}
export function CartCatalog({ kind }: { kind: "tables" | "gifts" }) {
  const state = useCart();
  function add(addition: CartAddition) {
    // Read again at the action boundary; another mounted cart control may have saved.
    // Let the product form show validation errors beside the action the buyer used.
    const next = addToCart(readShopping(sessionStorage).cart, addition);
    if (!state.update(next)) throw new Error("Your cart could not be saved. Review your cart before trying again.");
    return true;
  }
  return <>
    {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
    {!state.ready ? <p>Loading your cart…</p> : state.reference ? <section className={styles.summary}>
      <h2>You have a checkout to finish</h2><p>Check its result before adding more items so you do not pay twice.</p><Link href="/gala/cart">View your checkout</Link>
    </section> : <OrderFormContent kind={kind} addToCart={add} />}
  </>;
}
export default function GalaCart() {
  const live = useLiveGala();
  const state = useCart();
  const [agreed, setAgreed] = useState(false), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    // Back from Stripe may restore this page with its redirect state intact.
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) { lock.current = false; setBusy(false); }
    };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (lock.current || state.reference || !state.ready) return;
    lock.current = true; setBusy(true); state.setError("");
    try {
      if (!agreed) throw new Error("Please acknowledge the no-refund policy.");
      const payload: CheckoutRequest = checkoutRequest.parse(cartCheckout(readShopping(sessionStorage).cart, crypto.randomUUID()));
      // Save before networking. A lost response must resume this same purchase.
      sessionStorage.setItem(FLYER_ATTEMPT_KEY, JSON.stringify(payload));
      sessionStorage.setItem(CHECKOUT_REFERENCE_KEY, payload.requestId); cartChanged();
      const response = await fetch("/api/gala/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) {
        if (result.code === "CART_UNAVAILABLE") {
          sessionStorage.removeItem(FLYER_ATTEMPT_KEY); sessionStorage.removeItem(CHECKOUT_REFERENCE_KEY); cartChanged();
        }
        throw new Error(result.error || "Checkout could not be confirmed. Resume the same checkout below.");
      }
      window.location.assign(checkoutUrl(result.url));
    } catch(e) {
      state.setError(message(e)); state.refresh(); lock.current = false; setBusy(false);
    }
    // Keep the loading screen until navigation completes. Mounting the status
    // reader while checkout is being created can report a nonexistent order.
  }
  function reset() {
    try { sessionStorage.removeItem(FLYER_ATTEMPT_KEY); sessionStorage.removeItem(CHECKOUT_REFERENCE_KEY); setAgreed(false); state.setError(""); cartChanged(); }
    catch(e) { state.setError(message(e)); }
  }
  const { cart } = state;
  return <>
    <p className={styles.cartReminder}>{SAME_TAB_NOTICE}</p>
    {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
    {busy ? <section className={styles.summary} aria-label="Opening checkout" aria-busy="true">
      <h2>Opening secure checkout…</h2>
      <p role="status">Please wait while we prepare your order and take you to Stripe.</p>
    </section> : !state.ready ? <p>Loading your cart…</p> : state.reference ? <SandboxOrderStatus key={state.reference} id={state.reference} startAnother={reset} />
      : cart.purchases.length + cart.gifts.length === 0 ? <section className={styles.summary}><h2>Your cart is empty</h2><p>Add a table, tickets, or gifts to get started.</p><ContinueShopping /></section>
      : <form onSubmit={submit}><fieldset disabled={busy} className={styles.formSection}>
        <legend className="sr-only">Review your cart and checkout</legend>
        <h2>Your selections</h2>
        {cart.purchases.map((p, index) => {
          const table = TABLES.find(t => t.id === p.product), quote = quotePurchase(p);
          return <section key={index} className={styles.cartItem} aria-label={`Selection ${index + 1}`}>
            <div><h3>{quote.description}</h3><p>{money(quote.total)} · {quote.seats} purchased {quote.seats === 1 ? "seat" : "seats"}</p></div>
            <label className={styles.field}>{table ? "Extra seats" : "Ticket quantity"}<select value={table ? p.extraSeats : p.quantity} onChange={e => state.update({ ...cart, purchases: cart.purchases.map((item,i) => i === index ? { ...item, [table ? "extraSeats" : "quantity"]: Number(e.target.value) } : item) })}>
              {Array.from({ length: table ? 3 : 10 }, (_,i) => table ? i : i+1).map(n => <option key={n}>{n}</option>)}
            </select></label>
            <button type="button" className={styles.secondary} onClick={() => state.update({ ...cart, purchases: cart.purchases.filter((_,i) => i !== index) })}>Remove {table?.name ?? "tickets"}</button>
          </section>;
        })}
        {cart.gifts.map((g,index) => <section key={index} className={styles.cartItem} aria-label={`Gifts for ${g.student}`}>
          <div><h3>Gifts for {g.student}</h3><p>{money((g.roses+g.cookies)*1000)}</p></div>
          <div className={styles.fields}>
            <label className={styles.field}>Student name<input required maxLength={120} value={g.student} onChange={e => state.update({ ...cart, gifts: cart.gifts.map((item,i) => i===index ? {...item,student:e.target.value} : item) })}/></label>
            <label className={styles.field}>Grade<select value={g.grade} onChange={e => state.update({ ...cart, gifts: cart.gifts.map((item,i) => i===index ? {...item,grade:e.target.value as typeof g.grade} : item) })}>{[9,10,11,12].map(n=><option key={n}>{n}</option>)}</select></label>
            {(["roses","cookies"] as const).map(field => <label key={field} className={styles.field}>{field === "roses" ? "Roses" : "Cookie bags"} · $10 each<select value={g[field]} onChange={e => state.update({ ...cart, gifts: cart.gifts.map((item,i) => i===index ? {...item,[field]:Number(e.target.value)} : item) })}>
              {Array.from({length:51},(_,i)=>i).map(n=><option key={n} disabled={n===0 && g[field === "roses" ? "cookies" : "roses"]===0}>{n}</option>)}
            </select></label>)}
          </div>
          <button type="button" className={styles.secondary} onClick={() => state.update({ ...cart, gifts: cart.gifts.filter((_,i)=>i!==index) })}>Remove gifts for {g.student}</button>
        </section>)}
        <ContinueShopping />
        <div className={styles.orderLayout}>
          <section><h2>Your information</h2><p>Enter your details once for this whole order. You can edit them before paying.</p>
            <div className={styles.fields}>{(["name","email","phone"] as const).map(field => <label key={field} className={styles.field}>{field==="name"?"Your name":field==="email"?"Email address":"Phone number"}
              <input required type={field==="email"?"email":field==="phone"?"tel":"text"} autoComplete={field==="name"?"name":field==="email"?"email":"tel"} maxLength={field==="name"?120:field==="email"?254:30} value={cart.contact[field]}
                onChange={e=>state.update({...cart,contact:{...cart.contact,[field]:e.target.value}})}/>
            </label>)}</div>
          </section>
          <aside className={styles.summary} aria-label="Cart total"><h2>One order, one payment</h2><p className={styles.price}>{money(cartTotal(cart))}</p>
            <p>Tables are reserved when you open checkout, for about 35 minutes. Adding them to your cart does not reserve them. Availability is checked before checkout opens.</p>
            <label className={styles.agreement}><input type="checkbox" required checked={agreed} onChange={e=>setAgreed(e.target.checked)}/><span>I understand that all sales are final and no refunds are offered.</span></label>
            <button className={styles.primary} disabled={busy}>{busy?"Opening checkout…":live ? "Continue to secure checkout" : "Continue to Stripe test checkout"}</button>
            <p className={styles.fine}>{live ? "Enter your payment details securely on Stripe’s website. Your order is confirmed after payment." : "Test only. Enter the test card on Stripe’s website. No real money is charged."}</p>
          </aside>
        </div>
      </fieldset></form>}
  </>;
}
