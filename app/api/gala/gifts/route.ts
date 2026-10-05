import { authorizeStaff } from "@/lib/gala/backend/request-access";
import { backendEnabled, readBackendConfig } from "@/lib/gala/backend/config";
import { SupabaseOrderStore } from "@/lib/gala/backend/store";
import { filterGifts, giftsCsv, giftUpdate } from "@/lib/gala/gift-fulfillment";
export const runtime="nodejs";
async function handle(request:Request,write:boolean) {
  if(!backendEnabled(process.env)) return new Response(null,{status:404});
  let staffSession: string | undefined;
  try { staffSession = await authorizeStaff(request); }
  catch { return new Response(null,{status:401}); }
  try {
    const config=readBackendConfig(process.env),store=new SupabaseOrderStore(config.url,config.dbKey); store.staffSession = staffSession;
    await store.verifyEnvironment();
    if(write) {
      const body=await request.text(); if(body.length>2048)return new Response(null,{status:413});
      let json;try {json=JSON.parse(body);}catch{return Response.json({error:"Invalid gift update."},{status:400});}
      const parsed=giftUpdate.safeParse(json);
      if(!parsed.success)return Response.json({error:"Check the gift status and correction reason."},{status:400});
      await store.setGiftStatus(parsed.data);
    }
    const rows=await store.gifts(),query=new URL(request.url).searchParams;
    if(!write && query.get("format")==="csv") {
      const filter=query.get("filter")||"all";
      if(!["all","pending","prepared","delivered"].includes(filter))return new Response(null,{status:400});
      return new Response(giftsCsv(filterGifts(rows,filter)),{headers:{"Content-Type":"text/csv; charset=utf-8",
        "Content-Disposition":'attachment; filename="gala-2027-development-gifts.csv"',"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
    }
    return Response.json({gifts:rows},{headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({error:write?"Gift update was not confirmed. Refresh before retrying. Gifts must be prepared before handout, and corrections need a reason.":"Cannot load gift fulfillment. Check the local connection and development migration 004."},{status:write?409:503});}
}
export const GET=(request:Request)=>handle(request,false);
export const POST=(request:Request)=>handle(request,true);
