"use client";
import { useEffect,useRef,useState } from "react";
import Link from "next/link";
import { SandboxAccess } from "./SandboxCheckout";
import { OrderFormContent } from "./OrderForm";
import { INVITATION_ATTEMPT_KEY,invitationRequest,readInvitationAttempt,type InvitationRequest } from "@/lib/gala/invitations";
import styles from "./gala-sales.module.css";

function InvitationForm() {
  const [attempt,setAttempt]=useState<InvitationRequest|null>(null),[ready,setReady]=useState(false);
  const [confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const lock=useRef(false);
  useEffect(()=>{try{setAttempt(readInvitationAttempt(sessionStorage.getItem(INVITATION_ATTEMPT_KEY)));setReady(true);}
    catch{setError("The saved request could not be read. Check the development admin before clearing storage or submitting another request.");}},[]);
  async function send(payload:InvitationRequest) {
    const response=await fetch("/api/gala/invitations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    if(response.status===401||response.status===403)throw new Error("Session expired. Reload to unlock testing, then retry the saved request.");
    const result=await response.json();
    if(!response.ok||result.requestId!==payload.requestId)throw new Error(result.error||"Could not confirm the saved request. Retry this same request.");
    setConfirmed(true);
  }
  async function submit(details:Omit<InvitationRequest,"requestId">) {
    if(lock.current||attempt)return;lock.current=true;setBusy(true);setError("");
    try{const payload=invitationRequest.parse({...details,requestId:crypto.randomUUID()});
      sessionStorage.setItem(INVITATION_ATTEMPT_KEY,JSON.stringify(payload));setAttempt(payload);await send(payload);
    }catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}
  }
  async function retry(){if(lock.current||!attempt)return;lock.current=true;setBusy(true);setError("");
    try{await send(attempt);}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}}
  function reset(){try{sessionStorage.removeItem(INVITATION_ATTEMPT_KEY);setAttempt(null);setConfirmed(false);setError("");}
    catch{setError("Could not clear the saved request. Reload before starting another.");}}
  return <>{error&&<p role="alert" className={styles.error}>{error}</p>}
    {!ready?<p>Checking saved invitation request…</p>:attempt?<section className={styles.summary} aria-label="Invitation request status">
      <h2>{confirmed?"Test invitation request received":"Check your saved request"}</h2>
      <p role="status">{confirmed?"Your test request is saved. Open Invitations in Gala admin to review the addresses and practice preparing the mailing. Nothing has been mailed."
        :"A submission was started in this browser. Confirm or retry the same request below to avoid duplicates."}</p>
      <p>{attempt.recipients.length} recipient{attempt.recipients.length===1?"":"s"} · requested by {attempt.contact.name}</p>
      <ul>{attempt.recipients.map((r,i)=><li key={i}>{r.name} — {r.address}{r.address2?`, ${r.address2}`:""}, {r.city}, {r.state} {r.zip}</li>)}</ul>
      <p className={styles.fine}>Request reference: <span style={{overflowWrap:"anywhere"}}>{attempt.requestId}</span></p>
      {confirmed?<button className={styles.primary} onClick={reset}>Start another test invitation request</button>
        :<button className={styles.primary} disabled={busy} onClick={()=>void retry()}>{busy?"Checking…":"Confirm or retry saved request"}</button>}
      <p className={styles.fine}>An invitation does not reserve a seat. No payment or email is sent. <Link href="/gala/preview/admin">View in Gala admin</Link></p>
    </section>:<OrderFormContent kind="invitations" invite={submit} busy={busy}/>}</>;
}
export default function SandboxInvitations(){return <SandboxAccess invitations><InvitationForm/></SandboxAccess>;}
