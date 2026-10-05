// Foreground development worker. Database retry/lease state survives process restarts.
import Stripe from 'stripe';
import {setTimeout as delay} from 'node:timers/promises';
import {readBackendConfig,DEVELOPMENT_STRIPE_ACCOUNT} from '../lib/gala/backend/config';
import {SupabaseOrderStore} from '../lib/gala/backend/store';
import {SupabaseRecoveryStore} from '../lib/gala/backend/recovery-store';
import {recoveryPass} from '../lib/gala/backend/recovery';
async function main(){
  process.loadEnvFile('.env.local');
  const config=readBackendConfig({...process.env,NODE_ENV:process.env.NODE_ENV||'development'});
  const stripe=new Stripe(config.key,{maxNetworkRetries:1,timeout:20000});
  if((await stripe.accounts.retrieveCurrent()).id!==DEVELOPMENT_STRIPE_ACCOUNT)throw new Error('Wrong sandbox');
  const store=new SupabaseOrderStore(config.url,config.dbKey);await store.verifyEnvironment();
  const queue=new SupabaseRecoveryStore(config.url,config.dbKey);
  const once=process.argv.includes('--once');
  let stopped=false;const controller=new AbortController();
  for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{stopped=true;controller.abort();});
  console.log('Development payment recovery started. No checkout creation or accounting sync.');
  do {
    try {await store.verifyEnvironment();const result=await recoveryPass(queue,store,stripe);console.log(`Recovery pass: ${result.checked} checked.`);}
    catch {console.error('Recovery pass failed; holds are retained and leases can be retried.');if(once)process.exitCode=1;}
    if(once||stopped)break;
    await delay(60_000,undefined,{signal:controller.signal}).catch(()=>{});
  }while(!stopped);
}
main().catch(()=>{console.error('Development recovery could not start. Check environment and migration 008.');process.exitCode=1;});
