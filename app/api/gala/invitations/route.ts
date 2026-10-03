import { backendEnabled, readBackendConfig } from "@/lib/gala/backend/config";
import { authorizeDevelopment } from "@/lib/gala/backend/server";
import { SupabaseOrderStore } from "@/lib/gala/backend/store";
import { duplicateInvitations,filterInvitations,invitationRequest,invitationUpdate,invitationsCsv } from "@/lib/gala/invitations";
export const runtime="nodejs";
async function handle(request:Request) {
  if(!backendEnabled(process.env))return new Response(null,{status:404});
  try{authorizeDevelopment(request,readBackendConfig(process.env).token);}catch{return new Response(null,{status:401});}
  const headers={"Cache-Control":"no-store"};
  try{
    const config=readBackendConfig(process.env),store=new SupabaseOrderStore(config.url,config.dbKey);
    await store.verifyEnvironment();
    if(request.method!=="GET"){
      const body=await request.text();if(body.length>(request.method==="POST"?24000:2048))return new Response(null,{status:413,headers});
      let json;try{json=JSON.parse(body);}catch{return Response.json({error:"Invalid invitation request."},{status:400,headers});}
      if(request.method==="POST"){
        const parsed=invitationRequest.safeParse(json);
        if(!parsed.success)return Response.json({error:"Check the requester and mailing address fields."},{status:400,headers});
        const requestId=await store.requestInvitations(parsed.data);
        return Response.json({requestId,recipientCount:parsed.data.recipients.length},{headers});
      }
      const parsed=invitationUpdate.safeParse(json);
      if(!parsed.success)return Response.json({error:"Check the status and correction reason."},{status:400,headers});
      await store.setInvitationStatus(parsed.data);
      return Response.json({saved:true},{headers});
    }
    const rows=await store.invitations(),query=new URL(request.url).searchParams;
    const filter=query.get("filter")||"all";
    if(!["all","requested","prepared","mailed"].includes(filter))return new Response(null,{status:400,headers});
    if(query.get("format")==="csv")return new Response(invitationsCsv(filterInvitations(rows,filter),duplicateInvitations(rows)),{headers:{...headers,
      "Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="gala-2027-development-invitations.csv"',"X-Content-Type-Options":"nosniff"}});
    return Response.json({invitations:rows},{headers});
  }catch{return Response.json({error:request.method==="POST"?"Request not confirmed. Retry the same saved request; do not start another."
    :request.method==="PATCH"?"Update not confirmed. Refresh before retrying. Prepare before mailing; corrections need a reason."
    :"Cannot load invitations. Check the local connection and development migration 005."},{status:request.method==="GET"?503:409,headers});}
}
export const GET=handle;
export const POST=handle;
export const PATCH=handle;
