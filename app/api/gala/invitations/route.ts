import { backendEnabled, readBackendConfig } from "@/lib/gala/backend/config";
import { authorizeCustomer, authorizeStaff } from "@/lib/gala/backend/request-access";
import { SupabaseOrderStore } from "@/lib/gala/backend/store";
import { duplicateInvitations,filterInvitations,invitationRequest,invitationPatch,invitationsCsv } from "@/lib/gala/invitations";
import { createHash } from "node:crypto";
import { InvitationPrintError, invitationLabelsHtml, invitationPrintScript, invitationPrintProblem } from "@/lib/gala/invitation-print";
export const runtime="nodejs";
async function handle(request:Request) {
  if(!backendEnabled(process.env))return new Response(null,{status:404});
  let customerHash: string | undefined, staffSession: string | undefined;
  try{if(request.method==="POST") customerHash=authorizeCustomer(request); else staffSession=await authorizeStaff(request);}
  catch{return new Response(null,{status:401});}
  const headers={"Cache-Control":"no-store"};
  try{
    const config=readBackendConfig(process.env),store=new SupabaseOrderStore(config.url,config.dbKey);
    store.customerHash=customerHash; store.staffSession=staffSession;
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
      const parsed=invitationPatch.safeParse(json);
      if(!parsed.success)return Response.json({error:"Check the address, status and correction reason."},{status:400,headers});
      if ("action" in parsed.data && parsed.data.action === "duplicate") await store.resolveInvitationDuplicate(parsed.data);
      else if ("action" in parsed.data) await store.setInvitationAddress(parsed.data);
      else await store.setInvitationStatus(parsed.data);
      return Response.json({saved:true},{headers});
    }
    const rows=await store.invitations(),query=new URL(request.url).searchParams;
    const filter=query.get("filter")||"all";
    if(query.get("format")==="labels"){
      const skip=query.get("skip")||"0";
      if(!/^(?:[0-9]|[12][0-9])$/.test(skip))return Response.json({error:"Skip must be a whole number from 0 to 29."},{status:400,headers});
      try{return new Response(invitationLabelsHtml(rows,filter,Number(skip)),{headers:{...headers,
        "Content-Type":"text/html; charset=utf-8","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer",
        "X-Robots-Tag":"noindex, nofollow, noarchive",
        "Content-Security-Policy":`default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${createHash("sha256").update(invitationPrintScript).digest("base64")}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`}});
      }catch(error){if(error instanceof InvitationPrintError)return new Response(invitationPrintProblem(error.message),{status:409,headers:{...headers,"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'none'; frame-ancestors 'none'; base-uri 'none'","X-Content-Type-Options":"nosniff"}});throw error;}
    }
    if(!["all","requested","prepared","mailed"].includes(filter))return new Response(null,{status:400,headers});
    if(query.get("format")==="csv")return new Response(invitationsCsv(filterInvitations(rows,filter),duplicateInvitations(rows)),{headers:{...headers,
      "Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="gala-2027-development-invitations.csv"',"X-Content-Type-Options":"nosniff"}});
    return Response.json({invitations:rows},{headers});
  }catch{return Response.json({error:request.method==="POST"?"Request not confirmed. Retry the same saved request; do not start another."
    :request.method==="PATCH"?"Update not confirmed. Refresh before retrying. Mailed addresses are locked; corrections need a reason. Check that development migration 006 is installed for address edits."
    :"Cannot load invitations. Check the local connection and development migrations."},{status:request.method==="GET"?503:409,headers});}
}
export const GET=handle;
export const POST=handle;
export const PATCH=handle;
