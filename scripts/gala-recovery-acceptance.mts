// Explicit development acceptance exercise. Uses real deadlines; never changes SQL clocks.
// node --import tsx scripts/gala-recovery-acceptance.mts start|interrupt|resume|finish|status
// Keep other recovery workers/webhook forwarders stopped during the exercise.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { readBackendConfig, DEVELOPMENT_STRIPE_ACCOUNT } from '../lib/gala/backend/config';
import { SupabaseOrderStore } from '../lib/gala/backend/store';
import { SupabaseRecoveryStore } from '../lib/gala/backend/recovery-store';
import { recoveryPass } from '../lib/gala/backend/recovery';
import { startCheckout } from '../lib/gala/backend/checkout';
import { databaseFetch } from '../lib/gala/backend/database-fetch';

process.loadEnvFile('.env.local');
const config=readBackendConfig({...process.env,NODE_ENV:'development'});
const stripe=new Stripe(config.key,{timeout:20000,maxNetworkRetries:1});
const store=new SupabaseOrderStore(config.url,config.dbKey);
const queue=new SupabaseRecoveryStore(config.url,config.dbKey);
const db=createClient(config.url,config.dbKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:databaseFetch()}});
const root=new URL('../.codex-remote-attachments/recovery-acceptance/',import.meta.url);
const statePath=new URL('state.local.json',root);
type Checkpoint={orderId:string;token:string;phase:string;leaseUntil:string};
type State={startedAt:string;naturalId:string;crashId:string;expiresAt?:number;before:Record<string,unknown[]>;checkpoints:Checkpoint[];resumed?:boolean;finished?:boolean};
let state:State;
const mode=process.argv[2];
async function rows(table:string){const r=await db.from(table).select('*');assert.ifError(r.error);return r.data!;}
async function snapshot(exclude:string[]=[]){
  const result:Record<string,unknown[]>={};
  for(const table of ['gala_orders','gala_inventory','gala_accounting_outbox','gala_invitation_requests','gala_invitation_recipients','gala_staff']){
    result[table]=(await rows(table)).filter(r=>table!=='gala_orders'||!exclude.includes(r.id)).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  return result;
}
async function save(){await writeFile(statePath,JSON.stringify(state,null,2));}
async function workerOnce(expected:number){
  const {stdout}=await promisify(execFile)(process.execPath,['--import','tsx',fileURLToPath(new URL('./gala-recover.mts',import.meta.url)),'--once'],{windowsHide:true,timeout:60000});
  assert.ok(stdout.includes(`Recovery pass: ${expected} checked.`),'Recovery CLI did not report the expected pass');
}
async function item(id:string){const r=await db.from('gala_payment_recovery').select('*').eq('order_id',id).single();assert.ifError(r.error);return r.data!;}
async function verifyBusiness(){
  assert.deepEqual(await snapshot([state.naturalId,state.crashId]),state.before,'Preexisting business records changed');
  const jobs=(await rows('gala_accounting_outbox')).filter(r=>[state.naturalId,state.crashId].includes(r.order_id));assert.equal(jobs.length,0);
}
async function create(id:string,label:string){
  await startCheckout(store,stripe,{requestId:id,kind:'tables',allSalesFinal:true,
    contact:{name:`Fictional Recovery ${label}`,email:'gala-recovery@example.com',phone:'4325550100'},
    purchase:{product:'platinum',quantity:1,extraSeats:0}},config.origin);
  const order=await store.get(id);assert.ok(order.stripe_session_id);return stripe.checkout.sessions.retrieve(order.stripe_session_id);
}
async function killAt(id:string,phase:string):Promise<Checkpoint>{
  const child=spawn(process.execPath,['--import','tsx',fileURLToPath(import.meta.url),'child',id,phase],{stdio:['ignore','ignore','ignore','ipc'],windowsHide:true});
  const exited=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
  try {
    const point=await new Promise<Checkpoint>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Child checkpoint timed out')),60000);
      child.once('message',value=>{clearTimeout(timer);resolve(value as Checkpoint);});
      child.once('error',()=>{clearTimeout(timer);reject(new Error('Child failed to start'));});
      child.once('exit',()=>{clearTimeout(timer);reject(new Error('Child exited before checkpoint'));});
    });
    assert.equal(point.orderId,id);assert.equal(point.phase,phase);
    assert.equal(child.kill('SIGKILL'),true);await exited;
    return point;
  } finally {if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exited;}}
}
async function main(){
  assert.equal((await stripe.accounts.retrieveCurrent()).id,DEVELOPMENT_STRIPE_ACCOUNT);await store.verifyEnvironment();
  if(mode==='child'){
    const id=process.argv[3],phase=process.argv[4];let token='';
    const checkpoint=async()=>{
      const saved=await item(id);assert.equal(saved.lease_token,token);
      process.send!({orderId:id,token,phase,leaseUntil:saved.lease_until});
      await new Promise(()=>{});
    };
    await recoveryPass({claim:async value=>{token=value;const order=await queue.claim(value);assert.equal(order?.id,id);if(phase==='after-claim')await checkpoint();return order;},
      finish:async(orderId,value,outcome)=>{assert.equal(orderId,id);assert.equal(value,token);assert.equal(outcome,'expired');await checkpoint();}},store,stripe,1);
    throw new Error('Child missed checkpoint');
  }
  if(mode==='start'){
    await mkdir(root,{recursive:true});
    let prior:State|undefined;try{prior=JSON.parse(await readFile(statePath,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    assert.ok(!prior,'An acceptance run already exists; use its remaining stages, do not overwrite evidence');
    assert.equal((await store.pending()).length,0,'Other pending orders must be resolved before this exercise');
    assert.ok((await rows('gala_payment_recovery')).every(r=>['paid','expired'].includes(r.outcome)),'Other recovery work exists');
    const inventory=(await store.dashboard()).inventory;assert.ok(inventory.every(r=>r.capacity===20&&!r.board_confirmed));
    assert.ok(inventory.find(r=>r.tier==='platinum')!.available>=2);
    state={startedAt:new Date().toISOString(),naturalId:randomUUID(),crashId:randomUUID(),before:await snapshot(),checkpoints:[]};await save();
    const session=await create(state.naturalId,'Natural Expiration');state.expiresAt=session.expires_at;await save();
    assert.equal(session.status,'open');assert.equal(session.payment_intent,null);
    console.log(JSON.stringify({stage:'started',naturalOrder:state.naturalId,expiresAt:new Date(session.expires_at*1000).toISOString(),remainingMinutes:Math.ceil((session.expires_at*1000-Date.now())/60000)}));return;
  }
  state=JSON.parse(await readFile(statePath,'utf8'));
  if(mode==='interrupt'){
    assert.equal(state.checkpoints.length,0,'Interruption stage already started');
    state.checkpoints.push(await killAt(state.naturalId,'after-claim'));await save();
    const session=await create(state.crashId,'Interrupted Save');
    await stripe.checkout.sessions.expire(session.id,{}, {idempotencyKey:`gala-expire-${state.crashId}`});
    state.checkpoints.push(await killAt(state.crashId,'after-order-save'));await save();
    assert.equal((await store.get(state.naturalId)).status,'awaiting_payment');assert.equal((await store.get(state.crashId)).status,'expired');
    assert.equal(await queue.claim(randomUUID()),null,'Leased work must not be taken by competing workers');
    for(const point of state.checkpoints){const r=await item(point.orderId);assert.equal(r.attempts,1);assert.equal(r.lease_token,point.token);}
    await verifyBusiness();console.log(JSON.stringify({stage:'interrupted',realChildrenTerminated:2,holdsPreserved:true,competingClaimDenied:true,resumeAfter:state.checkpoints.map(p=>p.leaseUntil).sort().at(-1)}));return;
  }
  if(mode==='resume'){
    assert.equal(state.checkpoints.length,2);assert.ok(!state.resumed);
    assert.ok(state.checkpoints.every(p=>Date.parse(p.leaseUntil)+2000<Date.now()),'Wait for actual hosted five-minute leases to expire');
    const result=await recoveryPass(queue,store,stripe);assert.equal(result.checked,2);
    for(const point of state.checkpoints){const r=await item(point.orderId);assert.equal(r.attempts,2);assert.equal(r.lease_token,null);await assert.rejects(queue.finish(point.orderId,point.token,'expired'));}
    assert.equal((await store.get(state.naturalId)).status,'awaiting_payment');assert.equal((await item(state.naturalId)).outcome,'pending');
    assert.equal((await item(state.crashId)).outcome,'expired');await verifyBusiness();state.resumed=true;await save();
    console.log('PASS: restarted recovery reclaimed both naturally elapsed leases, retained the open hold, finished the committed expiration, rejected both stale owners, and created no accounting.');return;
  }
  if(mode==='finish'){
    assert.ok(state.resumed);assert.ok(!state.finished);assert.ok(state.expiresAt!*1000<Date.now(),'Natural checkout deadline has not elapsed');
    const order=await store.get(state.naturalId);assert.equal(order.status,'awaiting_payment','No other worker/webhook should settle this fixture');
    const session=await stripe.checkout.sessions.retrieve(order.stripe_session_id!);assert.equal(session.status,'expired','Wait for Stripe to report natural expiration; do not explicitly expire it');
    assert.equal(session.payment_status,'unpaid');assert.equal(session.payment_intent,null);
    const before=(await store.dashboard()).inventory.find(r=>r.tier==='platinum')!;assert.equal(before.held,1);
    await workerOnce(1);assert.equal((await store.get(state.naturalId)).status,'expired');
    assert.equal((await item(state.naturalId)).outcome,'expired');await workerOnce(0);
    await assert.rejects(startCheckout(store,stripe,order.details,config.origin),/already closed/);
    const crash=await store.get(state.crashId);const crashSession=await stripe.checkout.sessions.retrieve(crash.stripe_session_id!);
    assert.equal(crashSession.status,'expired');assert.equal(crashSession.payment_status,'unpaid');assert.equal(crashSession.payment_intent,null);
    const after=(await store.dashboard()).inventory.find(r=>r.tier==='platinum')!;assert.equal(after.held,0);assert.equal(after.available,before.available+1);
    await verifyBusiness();state.finished=true;await save();
    console.log('PASS: Stripe naturally expired unpaid checkout; the database retained its hold until verification, then released it exactly once. Both fixtures expired, no accounting, existing records unchanged.');return;
  }
  assert.equal(mode,'status');
  const order=await store.get(state.naturalId);const session=await stripe.checkout.sessions.retrieve(order.stripe_session_id!);
  console.log(JSON.stringify({stage:state.finished?'complete':state.resumed?'waiting-natural-expiration':'in-progress',order:order.status,provider:session.status,expiresAt:new Date(session.expires_at*1000).toISOString(),remainingSeconds:Math.max(0,session.expires_at-Math.floor(Date.now()/1000)),checkpoints:state.checkpoints.length}));
}
main().catch(error=>{console.error(error instanceof assert.AssertionError?error.message:'Acceptance stage failed; inspect the retained run state and retry only after diagnosing the failure.');process.exitCode=1;});
