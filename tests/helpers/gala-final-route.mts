import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDevelopmentSession } from "../../lib/gala/backend/auth";
const origin="http://localhost:3000", token="a".repeat(64);
for(const k of ["VERCEL","VERCEL_ENV","GALA_BOARD_REVIEW","GALA_CLIENT_REVIEW"])delete process.env[k];
Object.assign(process.env,{NODE_ENV:"development",GALA_BACKEND_ENABLED:"true",GALA_ACCESS_MODE:"development",GALA_STRIPE_SECRET_KEY:"sk_test_fake",
 GALA_STRIPE_WEBHOOK_SECRET:"whsec_fake",GALA_DEVELOPMENT_TOKEN:token,GALA_SUPABASE_URL:"https://rhjwjfyjjdsfahlegqvd.supabase.co",GALA_SUPABASE_SECRET_KEY:"sb_secret_fake"});
let reads=0,allowed=false,batch:object|null=null;
globalThis.fetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input));reads++;
 assert.equal(url.origin,process.env.GALA_SUPABASE_URL);
 if(url.pathname.endsWith('/gala_environment'))return Response.json({name:'osg-gala-development'});
 if(url.pathname.endsWith('/gala_final_total'))return Response.json(batch);
 if(url.pathname.endsWith('/gala_ledger_snapshot'))return Response.json({orders:[],accounting:[]});
 if(url.pathname.endsWith('/gala_staff_identity')){assert.equal(JSON.parse(String(init?.body)).p_accounting,true);return Response.json(allowed?{userId:randomUUID(),accounting:true}:null);}
 throw new Error('Unexpected transport');
};
const {GET,POST}=await import('../../app/api/gala/quickbooks/final-total/route');
const cookie=`gala_development_session=${createDevelopmentSession(token)}`;
const req=(method='GET',body?:object,extra:Record<string,string>={},query='')=>new Request(origin+'/api/gala/quickbooks/final-total'+query,{method,headers:{cookie,origin,...extra},...(body?{body:JSON.stringify(body)}:{})});
assert.equal((await GET(new Request(origin+'/api/gala/quickbooks/final-total'))).status,401);assert.equal(reads,0);
const response=await GET(req());assert.equal(response.status,200);assert.equal((await response.json()).enabled,false);
assert.equal((await POST(req('POST',{closeSales:true,revision:'a'.repeat(64)}))).status,404);
process.env.GALA_QB_FINAL_ENABLED='true';let count=reads;
assert.equal((await POST(req('POST',{}, {origin:'https://evil.example'}))).status,401);assert.equal(reads,count);
assert.equal((await POST(req('POST',{closeSales:false,revision:'a'.repeat(64)}))).status,400);
assert.equal((await POST(req('POST',{batchId:'bad-id'}))).status,400);
batch={id:randomUUID(),lines:[],source:{orders:[],accounting:[]},amount:6000,status:'synced',receipt_id:'99'};
const download=await GET(req('GET',undefined,{},'?format=saved'));assert.equal(download.status,200);assert.match(download.headers.get('content-disposition')!,/attachment/);assert.equal((await download.json()).batch.receiptId,'99');
process.env.GALA_ACCESS_MODE='individual';const staff=new Request(origin+'/api/gala/quickbooks/final-total',{headers:{cookie:'gala_staff_session='+'b'.repeat(64)}});
assert.equal((await GET(staff)).status,401);allowed=true;assert.equal((await GET(staff)).status,200);
process.env.NODE_ENV='production';assert.equal((await GET(req())).status,404);assert.equal((await POST(req('POST',{}))).status,404);
// Complete POST path: real SQL/store/route/client, fake Intuit HTTP only.
const {finalDatabase}=await import('./gala-final-database.mjs');
const {priceRequest}=await import('../../lib/gala/backend/domain');
const {ledgerReport}=await import('../../lib/gala/backend/ledger');
const {sealTokens}=await import('../../lib/gala/backend/qb-tokens');
const c=await finalDatabase();
try {
 Object.assign(process.env,{NODE_ENV:'development',GALA_ACCESS_MODE:'development',GALA_QB_FINAL_ENABLED:'true',GALA_QB_ENVIRONMENT:'sandbox',
  GALA_QB_CLIENT_ID:'test',GALA_QB_CLIENT_SECRET:'fake',GALA_QB_REALM_ID:'123',GALA_QB_ENCRYPTION_KEY:'c'.repeat(64),
  GALA_QB_CUSTOMER_ID:'10',GALA_QB_ITEM_ID:'20',GALA_QB_INCOME_ACCOUNT_ID:'30',GALA_QB_CLEARING_ACCOUNT_ID:'40'});
 for(const key of ['GALA_QB_FINAL_INCOME_ACCOUNT_ID','GALA_QB_FINAL_ITEM_ID'])delete process.env[key];
 for(let i=0;i<2;i++){
  const quote=priceRequest({requestId:randomUUID(),kind:'gifts',allSalesFinal:true,contact:{name:'Endpoint Buyer',email:'endpoint@example.com',phone:'4325550100'},gifts:[{student:'Endpoint Student',grade:'12',roses:1,cookies:1}]});
  await c.store.reserve(quote);await c.store.apply(quote.details.requestId,'cs_test_'+quote.details.requestId,'paid','pi_'+quote.details.requestId,'evt_'+quote.details.requestId);
 }
 const sealed=sealTokens({realmId:'123',accessToken:'fake',refreshToken:'fake',expiresAt:Date.now()+3600000,refreshExpiresAt:Date.now()+86400000},process.env.GALA_QB_ENCRYPTION_KEY!);
 const receipts:any[]=[];let posts=0;
 globalThis.fetch=async(input,init)=>{
  const url=new URL(input instanceof Request?input.url:String(input));const body=init?.body?JSON.parse(String(init.body)):null;
  if(url.origin===process.env.GALA_SUPABASE_URL){
   if(url.pathname.endsWith('/gala_environment'))return Response.json({name:'osg-gala-development'});
   if(url.pathname.endsWith('/gala_qb_connection'))return Response.json({sealed_tokens:sealed});
   if(url.pathname.endsWith('/gala_final_total'))return Response.json(await c.totals.current());
   if(url.pathname.includes('/rpc/')){
    const fn=url.pathname.split('/').pop()!;assert.match(fn,/^gala_(final_|qb_|ledger_snapshot)/);
    const entries=Object.entries(body||{});const args=entries.map(([key],i)=>`${key}=>$${i+1}`).join(',');
    const values=entries.map(([,value])=>value&&typeof value==='object'?JSON.stringify(value):value);
    const result=(await c.db.query(`select ${fn}(${args}) as result`,values)).rows[0].result;
    return Response.json(result??null);
   }
  }
  assert.equal(url.origin,'https://sandbox-quickbooks.api.intuit.com');
  if(url.pathname.endsWith('/companyinfo/123'))return Response.json({CompanyInfo:{Country:'US'}});
  if(url.pathname.endsWith('/item/20'))return Response.json({Item:{Active:true,Type:'Service',IncomeAccountRef:{value:'30'}}});
  if(url.pathname.endsWith('/account/30'))return Response.json({Account:{Active:true,AccountType:'Income',Name:'Symphony Ball Revenue'}});
  if(url.pathname.endsWith('/account/40'))return Response.json({Account:{Active:true,AccountType:'Bank'}});
  if(url.pathname.endsWith('/customer/10'))return Response.json({Customer:{Active:true}});
  if(url.pathname.endsWith('/preferences'))return Response.json({Preferences:{CurrencyPrefs:{HomeCurrency:{value:'USD'}}}});
  if(url.pathname.endsWith('/query'))return Response.json({QueryResponse:{SalesReceipt:receipts}});
  if(url.pathname.endsWith('/salesreceipt')){posts++;receipts.push({...body,Id:'777',TotalAmt:body.Line[0].Amount});throw new Error('Lost create response');}
  throw new Error('Unexpected external request');
 };
 const revision=ledgerReport(await c.snapshot()).preview.revision;
 const sent=await POST(req('POST',{revision,closeSales:true}));assert.equal(sent.status,200);assert.equal((await sent.json()).outcome,'review');
 const saved=await c.totals.current();assert.equal(saved.lines.length,4);assert.equal(saved.amount,4000);
 const retry=await POST(req('POST',{batchId:saved.id}));assert.equal(retry.status,200);assert.equal((await retry.json()).batch.receiptId,'777');
 assert.equal((await POST(req('POST',{batchId:saved.id}))).status,200);assert.equal(posts,1);
 assert.equal((await POST(req('POST',{revision,closeSales:true}))).status,409);assert.equal(posts,1);
 assert.equal((await (await GET(req())).json()).batch.status,'synced');
 const frozen=await(await GET(req('GET',undefined,{},'?format=saved'))).json();assert.equal(frozen.lines.length,4);assert.equal(frozen.source.orders.length,2);
} finally {await c.db.close();}
console.log('Final route checks passed');
