import { randomUUID } from "node:crypto";
import type { Order, OrderStore } from "./domain";
import { reconcileSession, verifySession, DEVELOPMENT_CHECKOUT_SECONDS, type StripeGateway } from "./checkout";
export type RecoveryOutcome = "pending" | "creation_needs_review" | "retry_required" | "paid" | "expired";
export interface RecoveryStore {
  claim(token:string):Promise<Order|null>;
  finish(orderId:string,token:string,outcome:RecoveryOutcome):Promise<void>;
}
export async function recoverOrder(store:OrderStore,stripe:StripeGateway,order:Order,now=Date.now()):Promise<RecoveryOutcome> {
  if(order.status==='paid'||order.status==='expired')return order.status;
  if(!order.stripe_session_id)return now-Date.parse(order.created_at)>4*60_000?'creation_needs_review':'pending';
  try {
    const session=await stripe.checkout.sessions.retrieve(order.stripe_session_id);
    verifySession(order,session);
    if(session.status==='open'&&now>=Date.parse(order.created_at)+DEVELOPMENT_CHECKOUT_SECONDS*1000){
      // Payment may win the expiration race; a fresh read still decides the result.
      try {await stripe.checkout.sessions.expire(session.id,{}, {idempotencyKey:`gala-expire-${order.id}`});} catch {}
    }
    const state=await reconcileSession(store,stripe,session.id,`recovery-${session.id}`);
    return state==='unrelated'?'retry_required':state;
  } catch {return 'retry_required';}
}
export async function recoveryPass(queue:RecoveryStore,store:OrderStore,stripe:StripeGateway,limit=10,budgetMs=Infinity) {
  const deadline=Date.now()+budgetMs;
  let checked=0;
  for(let i=0;i<limit;i++){
    if(Date.now()>=deadline)break;
    const token=randomUUID(),order=await queue.claim(token);
    if(!order)break;
    const outcome=await recoverOrder(store,stripe,order);
    // Failed saves/worker termination leave the lease for a later worker to reclaim.
    await queue.finish(order.id,token,outcome);checked++;
  }
  return {checked};
}
