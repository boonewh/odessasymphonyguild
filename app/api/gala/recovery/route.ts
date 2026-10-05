import { authorizeStaff } from "@/lib/gala/backend/request-access";
import { z } from 'zod';
import { backendEnabled,readBackendConfig } from '@/lib/gala/backend/config';
import { SupabaseOrderStore } from '@/lib/gala/backend/store';
import { SupabaseRecoveryStore } from '@/lib/gala/backend/recovery-store';
export const runtime='nodejs';
const retry=z.object({orderId:z.uuid(),reason:z.string().trim().min(3).max(300)}).strict();
async function handle(request:Request){
  if(!backendEnabled(process.env))return new Response(null,{status:404});
  let staffSession: string | undefined;
  try{staffSession = await authorizeStaff(request);}catch{return new Response(null,{status:401});}
  const headers={'Cache-Control':'no-store'};
  try{
    const config=readBackendConfig(process.env);await new SupabaseOrderStore(config.url,config.dbKey).verifyEnvironment();
    const queue=new SupabaseRecoveryStore(config.url,config.dbKey); queue.staffSession=staffSession;
    if(request.method==='POST'){
      const text=await request.text();if(text.length>2048)return new Response(null,{status:413,headers});
      let body;try{body=retry.safeParse(JSON.parse(text));}catch{return new Response(null,{status:400,headers});}
      if(!body.success)return Response.json({error:'Select an order and give a review reason.'},{status:400,headers});
      await queue.retry(body.data.orderId,body.data.reason);
      return Response.json({queued:true},{headers});
    }
    return Response.json(await queue.dashboard(),{headers});
  }catch{return Response.json({error:request.method==='POST'?'Retry not confirmed. Refresh; the order may already be settled or being checked.':'Recovery status unavailable. Check the connection and development migration 008.'},{status:request.method==='POST'?409:503,headers});}
}
export const GET=handle;export const POST=handle;
