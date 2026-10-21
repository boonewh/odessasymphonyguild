import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {localPatronPayments,hostedPatronPayments} from '../lib/patron/payment-store.ts';
import {localPatronStore} from '../lib/patron/local-store.ts';
import {patronPaymentHandlers} from '../lib/patron/payment-http.ts';
import {openPatronCheckout,reconcilePatronSession,recoverPatronPayments,patronSessionParameters,isPatronCheckout} from '../lib/patron/payment.ts';
import {patronCheckoutOpen,patronPaymentsEnabled} from '../lib/patron/payment-config.ts';
import {PATRON_PERIOD} from '../lib/patron/model.ts';
const origin='http://localhost:3000', accessToken='c'.repeat(64), ownerHash=createHash('sha256').update(accessToken).digest('hex');
const schema=(await Promise.all(['001_patrons','002_approval','003_payments'].map(n=>readFile(`supabase/patron/${n}.sql`,'utf8')))).join('\n');
const paidApprovalSql=await readFile('supabase/patron/004_paid_approval.sql','utf8');
const input=(extra={})=>({requestId:randomUUID(),name:'Fictional Card Patron',email:'card@example.com',phone:'4325550100',consent:true,company:'',accessToken,...extra});
const reserved=(extra={})=>({...input(),period:PATRON_PERIOD,ownerHash,clientHash:'b'.repeat(64),mode:'sandbox',origin,...extra});
const request=(body,from=origin)=>new Request(origin+'/api/patron/checkout',{method:'POST',headers:{origin:from,'content-type':'application/json'},body:JSON.stringify(body)});
function fakeStripe(){
 const sessions=new Map(),keys=new Map(),intents=new Map(),creates=[];
 let loseResponse=false;
 const stripe={checkout:{sessions:{
  async create(params,{idempotencyKey}){
   creates.push({params,idempotencyKey});
   if(!keys.has(idempotencyKey)){
    const id='cs_test_'+randomUUID(); keys.set(idempotencyKey,id);
    sessions.set(id,{id,livemode:false,mode:'payment',currency:'usd',amount_total:10000,client_reference_id:params.client_reference_id,metadata:params.metadata,recovered_from:null,status:'open',payment_status:'unpaid',payment_intent:null,url:'https://checkout.stripe.com/c/pay/'+id});
   }
   if(loseResponse){loseResponse=false;throw new Error('simulated lost create response');}
   return sessions.get(keys.get(idempotencyKey));
  },async retrieve(id){if(!sessions.has(id))throw new Error('not found');return sessions.get(id);},
  async list(){return {data:[...sessions.values()],has_more:false};}
 }},paymentIntents:{async retrieve(id){return intents.get(id);}}};
 return {stripe,sessions,intents,creates,loseNext(){loseResponse=true;},pay(id){const session=sessions.get(id),pi='pi_'+randomUUID();session.payment_intent=pi;session.status='complete';session.payment_status='paid';session.url=null;intents.set(pi,{id:pi,livemode:false,currency:'usd',amount:10000,amount_received:10000,status:'succeeded',metadata:session.metadata});return pi;}};
}
async function setup(t){
 const db=new PGlite();t.after(()=>db.close());
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to anon,authenticated,service_role;');
 await db.exec(schema+'\n'+paidApprovalSql);
 const store=localPatronPayments(db),roster=localPatronStore(db),fake=fakeStripe();
 let enabled=true,open=true;
 const handlers=patronPaymentHandlers({enabled:()=>enabled,open:()=>open,config:()=>({origin,token:'d'.repeat(64),paymentMode:'sandbox'}),backend:async()=>({store,stripe:fake.stripe})});
 return {db,store,roster,fake,handlers,pause(){open=false;},disable(){enabled=false;}};
}
test('card checkout pins $100/year, shares review roster and reuses one checkout across retries and tabs',async t=>{
 const {store,roster,fake,handlers}=await setup(t);const first=input();
 const [a,b]=await Promise.all([handlers.checkout(request(first)),handlers.checkout(request({...first,requestId:randomUUID()}))]);
 assert.equal(a.status,200);assert.equal(b.status,200);const result=await a.json();
 assert.equal(fake.sessions.size,1);assert.equal((await roster.list(PATRON_PERIOD)).length,1);
 assert.deepEqual(await roster.names(PATRON_PERIOD),[]);assert.equal((await roster.list(PATRON_PERIOD))[0].dues_status,'card_pending');
 const params=fake.creates[0].params;assert.equal(params.line_items[0].price_data.unit_amount,10000);assert.equal(params.mode,'payment');assert.deepEqual(params.allowed_payment_method_types,['card']);
 assert.match(params.success_url,/\/patron\/payment\?payment=/);assert.equal(params.after_expiration.recovery.enabled,false);
 assert.equal((await handlers.checkout(request({...first,requestId:randomUUID(),accessToken:'e'.repeat(64)}))).status,409);
 assert.equal((await handlers.status(request({id:result.id,accessToken:'e'.repeat(64)}))).status,404);
 const privateResult=await (await handlers.status(request({id:result.id,accessToken}))).json();
 assert.equal(privateResult.status,'pending');assert.ok(!JSON.stringify(privateResult).includes(first.email));assert.ok(!('owner_hash' in privateResult));
 assert.ok(await store.get(result.id));
});
test('autofilled legacy company fields and current forms both reach the same private Stripe checkout',async t=>{
 const {handlers,fake,roster}=await setup(t);
 const legacy=input({company:'Fictional Autofilled Organization'});
 const trapped=await handlers.checkout(request({...legacy,patron_guard:'filled by bot'}));
 assert.equal(trapped.status,400);assert.equal(fake.creates.length,0);assert.equal((await roster.list(PATRON_PERIOD)).length,0);
 const oldForm=await handlers.checkout(request(legacy));assert.equal(oldForm.status,200);
 const original=await oldForm.json();assert.match(original.url,/^https:\/\/checkout\.stripe\.com\//);
 const {company,...current}=legacy;
 const newForm=await handlers.checkout(request({...current,patron_guard:''}));assert.equal(newForm.status,200);
 assert.equal((await newForm.json()).id,original.id);assert.equal(fake.sessions.size,1);
 const members=await roster.list(PATRON_PERIOD);assert.equal(members.length,1);assert.equal(members[0].published,false);
 assert.ok(!JSON.stringify(members).includes(company));
 assert.ok(!JSON.stringify(fake.creates).includes(company));
});

test('payment verification is idempotent, never approves names and cannot regress paid records',async t=>{
 const {store,roster,fake,handlers}=await setup(t);
 const result=await (await handlers.checkout(request(input()))).json();const p=await store.get(result.id);
 const pending=(await roster.list(PATRON_PERIOD))[0];
 await assert.rejects(roster.edit({id:pending.id,name:pending.name,email:pending.email,phone:pending.phone,published:true},PATRON_PERIOD),/patron_payment_required/);
 fake.pay(p.stripe_session_id);
 await Promise.all([reconcilePatronSession(store,fake.stripe,p.stripe_session_id,'sandbox'),reconcilePatronSession(store,fake.stripe,p.stripe_session_id,'sandbox')]);
 assert.equal((await store.get(p.id)).status,'paid');const member=(await roster.list(PATRON_PERIOD))[0];
 assert.equal(member.dues_status,'card_paid');assert.equal(member.published,false);assert.equal(member.approved_at,null);assert.deepEqual(await roster.names(PATRON_PERIOD),[]);
 await store.apply(p.id,p.stripe_session_id,'expired',null);assert.equal((await store.get(p.id)).status,'paid');
 const repeated=await handlers.checkout(request(input({requestId:randomUUID()})));assert.equal(repeated.status,200);assert.equal((await repeated.json()).status,'paid');assert.equal(fake.sessions.size,1);
 await roster.edit({id:member.id,name:'Corrected Paid Patron',email:member.email,phone:member.phone,published:true},PATRON_PERIOD);
 assert.deepEqual(await roster.names(PATRON_PERIOD),['Corrected Paid Patron']);
});
test('lost provider and database responses recover without creating a second Stripe session',async t=>{
 const {store,fake}=await setup(t);const payment=await store.start(reserved());fake.loseNext();
 await assert.rejects(openPatronCheckout(store,fake.stripe,payment,'sandbox'));
 assert.equal((await store.get(payment.id)).stripe_session_id,null);
 const broken={...store,async apply(){throw new Error('database unavailable');}};
 await assert.rejects(openPatronCheckout(broken,fake.stripe,payment,'sandbox'));
 const recovered=await openPatronCheckout(store,fake.stripe,payment,'sandbox');
 assert.equal(fake.sessions.size,1);assert.equal(new Set(fake.creates.map(c=>c.idempotencyKey)).size,1);
 assert.ok(recovered.payment.stripe_session_id);
 const old={...payment,created_at:new Date(Date.now()-25*60*60_000).toISOString()};
 await assert.rejects(openPatronCheckout(store,fake.stripe,old,'sandbox'),/review/);
});
test('wrong amounts, identities and incomplete payments never mark dues paid',async t=>{
 const {store,roster,fake}=await setup(t);const payment=await store.start(reserved());
 const opened=await openPatronCheckout(store,fake.stripe,payment,'sandbox'),session=fake.sessions.get(opened.payment.stripe_session_id);
 const original={...session};
 for(const change of [{amount_total:1},{livemode:true},{currency:'eur'},{client_reference_id:randomUUID()},{recovered_from:'cs_test_old'},{metadata:{...session.metadata,application:'osg-gala-development'}}]){
  Object.assign(session,original,change);await assert.rejects(reconcilePatronSession(store,fake.stripe,session.id,'sandbox'));
 }
 Object.assign(session,original);const pi=fake.pay(session.id);fake.intents.get(pi).amount_received=1;
 await assert.rejects(reconcilePatronSession(store,fake.stripe,session.id,'sandbox'));
 assert.equal((await store.get(payment.id)).status,'pending');assert.equal((await roster.list(PATRON_PERIOD))[0].dues_status,'card_pending');
});
test('only verified unpaid expiration allows a new payment; processing remains protected',async t=>{
 const {store,roster,fake}=await setup(t);const first=await store.start(reserved());
 const opened=await openPatronCheckout(store,fake.stripe,first,'sandbox'),session=fake.sessions.get(opened.payment.stripe_session_id);
 session.status='expired';session.url=null;session.payment_intent='pi_processing';
 fake.intents.set('pi_processing',{id:'pi_processing',livemode:false,currency:'usd',amount:10000,amount_received:0,status:'processing',metadata:session.metadata});
 await reconcilePatronSession(store,fake.stripe,session.id,'sandbox');assert.equal((await store.get(first.id)).status,'pending');
 fake.intents.get('pi_processing').status='canceled';await reconcilePatronSession(store,fake.stripe,session.id,'sandbox');
 assert.equal((await store.get(first.id)).status,'expired');assert.equal((await roster.list(PATRON_PERIOD))[0].dues_status,'card_expired');
 const expired=(await roster.list(PATRON_PERIOD))[0];
 await assert.rejects(roster.edit({id:expired.id,name:expired.name,email:expired.email,phone:expired.phone,published:true},PATRON_PERIOD),/patron_payment_required/);
 const next=await store.start(reserved());assert.notEqual(next.id,first.id);
 assert.equal((await roster.list(PATRON_PERIOD)).length,1);
 await reconcilePatronSession(store,fake.stripe,session.id,'sandbox');
 assert.equal((await roster.list(PATRON_PERIOD))[0].dues_status,'card_pending');
});
test('recovery finds missing session IDs and settles payments without a browser return',async t=>{
 const {store,fake,roster}=await setup(t);const payment=await store.start(reserved());fake.loseNext();
 await assert.rejects(openPatronCheckout(store,fake.stripe,payment,'sandbox'));
 fake.pay([...fake.sessions.keys()][0]);
 const results=await recoverPatronPayments(store,fake.stripe,'sandbox');assert.equal(results[0].status,'paid');
 assert.equal((await roster.list(PATRON_PERIOD))[0].published,false);
 assert.equal(fake.creates.length,1);
 assert.equal(isPatronCheckout({data:{object:{metadata:{application:'osg-patron-dues-test'}}}}),true);
 assert.equal(isPatronCheckout({data:{object:{metadata:{application:'osg-gala-development'}}}}),false);
});
test('public tampering, oversized bodies, closed checkout and wrong origin fail safely',async t=>{
 const {handlers,pause,disable,store,fake}=await setup(t);
 for(const extra of [{amount:1},{source:'check'},{published:true},{approved_at:'now'},{mode:'live'},{accessToken:'short'},{consent:false}]) assert.equal((await handlers.checkout(request(input(extra)))).status,400);
 assert.equal((await handlers.checkout(request(input(),'https://evil.example'))).status,403);
 assert.equal((await handlers.checkout(new Request(origin,{method:'POST',headers:{origin},body:'x'.repeat(2049)}))).status,413);
 const started=await (await handlers.checkout(request(input()))).json();pause();
 assert.equal((await handlers.checkout(request(input()))).status,409);
 fake.pay((await store.get(started.id)).stripe_session_id);
 assert.equal((await (await handlers.status(request({id:started.id,accessToken}))).json()).status,'paid');
 disable();assert.equal((await handlers.status(request({id:started.id,accessToken}))).status,404);
});
test('private payment RPCs deny browser roles; check recording cannot overwrite a card payment',async t=>{
 const {db,store,roster}=await setup(t);
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  await assert.rejects(db.query('select * from patron_payments'),/permission denied/);
  await assert.rejects(db.query("select patron_payment_start('{}')"),/permission denied/);
  await assert.rejects(db.query("select patron_record_check('{}','2026')"),/permission denied/);
  await db.exec('reset role');
 }
 const p=await store.start(reserved());let member=(await roster.list(PATRON_PERIOD))[0];
 await assert.rejects(roster.edit({id:member.id,name:member.name,email:member.email,phone:member.phone,published:false,checkReceived:true},PATRON_PERIOD),/conflict/);
 await store.apply(p.id,'cs_test_expired','expired',null);
 await db.exec('set role service_role');
 assert.equal(await roster.edit({id:member.id,name:member.name,email:member.email,phone:member.phone,published:false,checkReceived:true},PATRON_PERIOD),true);
 member=(await roster.list(PATRON_PERIOD))[0];assert.equal(member.dues_status,'check_recorded');assert.equal(member.published,false);
 await roster.edit({id:member.id,name:member.name,email:member.email,phone:member.phone,published:true},PATRON_PERIOD);
 assert.deepEqual(await roster.names(PATRON_PERIOD),[member.name]);
 await store.apply(p.id,'cs_test_expired','expired',null);
 assert.equal((await roster.list(PATRON_PERIOD))[0].dues_status,'check_recorded');
 await assert.rejects(store.start(reserved()),/conflict/);
});
test('paid-approval migration withdraws only unpaid approvals and prevents stale/direct publication',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to service_role;');
 await db.exec(schema);
 const store=localPatronPayments(db),roster=localPatronStore(db);
 const pending=await store.start(reserved());
 const paid=await store.start(reserved({email:'paid@example.com',name:'Paid Patron'}));
 await store.apply(paid.id,'cs_test_paid','paid','pi_paid');
 const manual=reserved({email:'',name:'Check Patron',source:'check',published:true});await roster.add(manual);
 await db.query('update patron_members set published=true where id in ($1,$2)',[pending.patron_id,paid.patron_id]);
 const before=await roster.list(PATRON_PERIOD);
 await db.exec(paidApprovalSql);
 const after=await roster.list(PATRON_PERIOD);
 for(const original of before){const changed=after.find(p=>p.id===original.id);for(const key of ['name','email','phone','dues_status','source'])assert.equal(changed[key],original[key]);
  if(original.dues_status==='card_pending'){assert.equal(changed.published,false);assert.equal(changed.approved_at,null);}else{assert.equal(changed.published,true);assert.deepEqual(changed.approved_at,original.approved_at);}}
 await db.exec('set role service_role');
 await assert.rejects(db.query('update patron_members set published=true where id=$1',[pending.patron_id]),/patron_payment_required/);
 await db.query('update patron_members set approved_at=now() where id=$1',[pending.patron_id]);
 assert.equal((await roster.list(PATRON_PERIOD)).find(p=>p.id===pending.patron_id).approved_at,null);
 // A lost/late payment update cannot accidentally approve the previous name.
 await store.apply(pending.id,'cs_test_later','paid','pi_later');
 const settled=(await roster.list(PATRON_PERIOD)).find(p=>p.id===pending.patron_id);assert.equal(settled.published,false);assert.equal(settled.approved_at,null);
 await roster.edit({id:settled.id,name:settled.name,email:settled.email,phone:settled.phone,published:true},PATRON_PERIOD);
 assert.ok((await roster.list(PATRON_PERIOD)).find(p=>p.id===settled.id).approved_at);
});

test('Patron card activation is independent of Gala and disabled on Preview/production by default',()=>{
 const live={NODE_ENV:'production',VERCEL_ENV:'production',GALA_LIVE_ENABLED:'true',PATRON_ENABLED:'true'};
 assert.equal(patronPaymentsEnabled(live),false);
 assert.equal(patronPaymentsEnabled({...live,PATRON_STRIPE_ENABLED:'true'}),true);
 assert.equal(patronCheckoutOpen({...live,PATRON_STRIPE_ENABLED:'true'}),false);
 assert.equal(patronCheckoutOpen({...live,PATRON_STRIPE_ENABLED:'true',PATRON_CARD_PAYMENTS_OPEN:'true'}),true);
 assert.equal(patronPaymentsEnabled({...live,VERCEL_ENV:'preview',PATRON_STRIPE_ENABLED:'true'}),false);
});

test('hosted payment adapter requests one RPC row, binds state atomically and pages the recovery queue',async()=>{
 const calls=[];
 const transport=async(url,init)=>{
  const parsed=new URL(String(url));calls.push({parsed,init});
  if(parsed.pathname.endsWith('/rpc/patron_payment_start')) {
   assert.match(new Headers(init.headers).get('accept'),/vnd.pgrst.object/);
   assert.equal(JSON.parse(init.body).p_input.amount,undefined);
   return Response.json({id:'saved',status:'pending'});
  }
  if(parsed.pathname.endsWith('/rpc/patron_payment_apply')) {
   assert.deepEqual(JSON.parse(init.body),{p_id:'saved',p_session:'cs_test_saved',p_status:'paid',p_payment:'pi_saved'});
   return new Response(null,{status:204});
  }
  if(init.method==='PATCH') return new Response(null,{status:204});
  if(parsed.searchParams.has('limit')) {
   assert.equal(parsed.searchParams.get('status'),'eq.pending');assert.equal(parsed.searchParams.get('limit'),'25');
   return Response.json([{id:'saved'}]);
  }
  return Response.json({id:'saved'});
 };
 const store=hostedPatronPayments('https://fictional.supabase.co','sb_secret_fake',transport);
 assert.equal((await store.start(reserved())).id,'saved');assert.equal((await store.get('saved')).id,'saved');
 await store.apply('saved','cs_test_saved','paid','pi_saved');assert.equal((await store.pending()).length,1);await store.touched('saved');assert.equal(calls.length,5);
});
