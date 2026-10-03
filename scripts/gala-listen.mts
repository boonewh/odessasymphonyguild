// Start the official Stripe CLI without exposing secrets in arguments or terminal output.
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import Stripe from "stripe";
import { DEVELOPMENT_STRIPE_ACCOUNT, DEVELOPMENT_SUPABASE_URL } from "../lib/gala/backend/config";

async function main() {
  process.loadEnvFile(".env.local");
  const key=process.env.GALA_STRIPE_SECRET_KEY || "";
  if (!/^(sk|rk)_test_\S+$/.test(key) || process.env.GALA_SUPABASE_URL!==DEVELOPMENT_SUPABASE_URL)
    throw new Error("Pinned development credentials required.");
  const stripe=new Stripe(key);
  if ((await stripe.accounts.retrieveCurrent()).id!==DEVELOPMENT_STRIPE_ACCOUNT) throw new Error("Wrong Stripe sandbox.");
  const cli=resolve("node_modules/@stripe/cli/bin/shim.js");
  const env={...process.env,STRIPE_API_KEY:key,STRIPE_DEVICE_NAME:"osg-gala-local"};
  const args=[cli,"listen","--events-from","@self","--events","checkout.session.completed,checkout.session.expired,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed","--forward-to","http://localhost:3000/api/gala/webhook","--skip-update","--color","off"];
  const result=await promisify(execFile)(process.execPath,[...args,"--print-secret"],{env,windowsHide:true,timeout:30000});
  const secret=/whsec_[a-zA-Z0-9]+/.exec(result.stdout)?.[0];
  if(!secret) throw new Error("Stripe listener did not provide a signing secret.");
  let local=await readFile(".env.local","utf8");
  const token=/^[a-f0-9]{64}$/.test(process.env.GALA_DEVELOPMENT_TOKEN||"")?process.env.GALA_DEVELOPMENT_TOKEN!:randomBytes(32).toString("hex");
  for(const [name,value] of Object.entries({GALA_STRIPE_WEBHOOK_SECRET:secret,GALA_DEVELOPMENT_TOKEN:token,GALA_BACKEND_ENABLED:"true",GALA_LOCAL_ORIGIN:"http://localhost:3000"})) {
    const pattern=new RegExp(`^${name}=.*$`,"m");
    local=pattern.test(local)?local.replace(pattern,`${name}=${value}`):`${local.trimEnd()}\n${name}=${value}\n`;
  }
  await writeFile(".env.local",local);
  console.log("Sandbox webhook signing secret and local authentication saved in ignored .env.local.");
  console.log("Forwarding Stripe sandbox events to http://localhost:3000/api/gala/webhook. Keep this process running.");
  const child=spawn(process.execPath,args,{env,windowsHide:true,stdio:["ignore","pipe","pipe"]});
  for(const stream of [child.stdout,child.stderr]) {
    let buffer="";stream.on("data",chunk=>{
      buffer+=chunk.toString();const lines=buffer.split(/\r?\n/);buffer=lines.pop()||"";
      for(const line of lines) console.log(line.replace(/whsec_\S+/g,"[signing secret saved locally]").replace(/(?:sk|rk)_(?:test|live)_\S+/g,"[redacted]"));
    });
  }
  child.on("error",()=>{console.error("Stripe listener could not start.");process.exitCode=1;});
  child.on("exit",code=>{process.exitCode=code||0;});
  for(const signal of ["SIGINT","SIGTERM"] as const) process.on(signal,()=>{child.kill();});
}
main().catch(()=>{console.error("Could not start the sandbox listener. No credentials were printed.");process.exitCode=1;});
