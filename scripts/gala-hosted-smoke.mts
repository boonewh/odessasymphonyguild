// Sandbox + specifically pinned development database only. Keeps expired audit records.
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { SupabaseOrderStore } from "../lib/gala/backend/store";
import { priceRequest } from "../lib/gala/backend/domain";
import { startCheckout, reconcileSession } from "../lib/gala/backend/checkout";
import { DEVELOPMENT_STRIPE_ACCOUNT, DEVELOPMENT_SUPABASE_URL } from "../lib/gala/backend/config";

async function main() {
  const key=process.env.GALA_STRIPE_SECRET_KEY || "";
  const url=process.env.GALA_SUPABASE_URL || "";
  const secret=process.env.GALA_SUPABASE_SECRET_KEY || "";
  if(!/^(sk|rk)_test_\S+$/.test(key) || url!==DEVELOPMENT_SUPABASE_URL || !secret.startsWith("sb_secret_"))
    throw new Error("Development credentials required");
  const stripe=new Stripe(key,{maxNetworkRetries:2,timeout:20000});
  if((await stripe.accounts.retrieveCurrent()).id!==DEVELOPMENT_STRIPE_ACCOUNT) throw new Error("Wrong sandbox");
  const store=new SupabaseOrderStore(url,secret);await store.verifyEnvironment();
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {count,error:countError}=await db.from("gala_orders").select("id",{count:"exact",head:true}).eq("tier","gold").neq("status","expired");
  if(countError || count!==0) throw new Error("Gold tier already has active orders; manual review required before race test");
  const {data:inventory,error:inventoryError}=await db.from("gala_inventory").select("capacity").eq("tier","gold").single();
  if(inventoryError || inventory?.capacity!==20) throw new Error("Expected placeholder inventory missing");
  const {error:capacityError}=await db.from("gala_inventory").update({capacity:1}).eq("tier","gold");
  if(capacityError) throw new Error("Cannot set up last-table test");
  let sessionId:string|null=null;
  try {
    const make=()=>({requestId:randomUUID(),kind:"tables",allSalesFinal:true,
      contact:{name:"Fictional Hosted Test",email:"gala-sandbox@example.com",phone:"4325550100"},
      purchase:{product:"gold",quantity:1,extraSeats:2}});
    const inputs=[make(),make()];
    const raced=await Promise.allSettled(inputs.map(input=>store.reserve(priceRequest(input))));
    if(raced.filter(r=>r.status==='fulfilled').length!==1) throw new Error("Last-table concurrency failed");
    const winner=inputs[raced.findIndex(r=>r.status==='fulfilled')];
    console.log("PASS: independent hosted database requests raced for one table; exactly one reserved it.");
    const result=await startCheckout(store,stripe,winner,"http://localhost:3000");
    const order=await store.get(result.orderId);sessionId=order.stripe_session_id;
    const duplicate=await startCheckout(store,stripe,winner,"http://localhost:3000");
    if(duplicate.url!==result.url) throw new Error("Checkout retry changed URL");
    console.log("PASS: hosted order and Stripe sandbox checkout are linked; retry reuses the checkout.");
    await stripe.checkout.sessions.expire(sessionId!);
    if(await reconcileSession(store,stripe,sessionId!,`hosted-smoke-${order.id}`)!=='expired') throw new Error("Expiry failed");
    await reconcileSession(store,stripe,sessionId!,`hosted-smoke-${order.id}`);
    const {count:active,error:activeError}=await db.from("gala_orders").select("id",{count:"exact",head:true}).eq("tier","gold").neq("status","expired");
    if(activeError || active!==0) throw new Error("Inventory remains held");
    const {count:queued,error:queueError}=await db.from("gala_accounting_outbox").select("order_id",{count:"exact",head:true}).eq("order_id",order.id);
    if(queueError || queued!==0) throw new Error("Unpaid order entered accounting");
    console.log("PASS: verified expiry freed the hosted inventory, retained the unpaid order, and queued no accounting sale.");
  } finally {
    try {
      if(sessionId) {
        const session=await stripe.checkout.sessions.retrieve(sessionId);
        if(session.status==='open') await stripe.checkout.sessions.expire(sessionId);
        await reconcileSession(store,stripe,sessionId,`hosted-smoke-cleanup-${sessionId}`);
      }
    } finally {
      const {error}=await db.from("gala_inventory").update({capacity:20}).eq("tier","gold");
      if(error) throw new Error("Could not restore placeholder inventory");
    }
  }
}
main().catch(()=>{console.error("Hosted development check failed; inspect test order state before repeating. Credentials were not printed.");process.exitCode=1;});
