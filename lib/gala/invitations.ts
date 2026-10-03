import { z } from "zod";
import { contactSchema, recipientsSchema, type Recipient } from "./model";
import { csvDocument } from "./csv";

export const invitationRequest = z.object({requestId:z.uuid(),contact:contactSchema,recipients:recipientsSchema}).strict();
export type InvitationRequest = z.infer<typeof invitationRequest>;
export const invitationStatus = z.enum(["requested","prepared","mailed"]);
export type InvitationStatus = z.infer<typeof invitationStatus>;
export const invitationUpdate = z.object({requestId:z.uuid(),recipientIndex:z.number().int().min(0).max(19),
  status:invitationStatus,revision:z.number().int().min(0),reason:z.string().trim().max(300).default("")}).strict();
export const invitationLabels:Record<InvitationStatus,string>={requested:"Needs preparation",prepared:"Prepared",mailed:"Mailed"};
export type InvitationRow = {request_id:string;recipient_index:number;recipient:Recipient;contact:InvitationRequest["contact"];
  status:InvitationStatus;revision:number;created_at:string;updated_at:string};
export const INVITATION_ATTEMPT_KEY="osg-gala-invitation-attempt-v1";
export function readInvitationAttempt(value:string|null) {return value===null?null:invitationRequest.parse(JSON.parse(value));}
export function filterInvitations(rows:InvitationRow[],filter:string){return rows.filter(r=>filter==="all"||r.status===filter);}
export function invitationKey(row:InvitationRow){return `${row.request_id}:${row.recipient_index}`;}
// Deliberately conservative: flag exact normalized name/address matches; never merge households.
export function duplicateInvitations(rows:InvitationRow[]) {
  const grouped=new Map<string,InvitationRow[]>();
  for(const row of rows){const r=row.recipient;
    const key=JSON.stringify([r.name,r.address,r.address2,r.city,r.state,r.zip].map(s=>s.trim().replace(/\s+/g," ").toLowerCase()));
    grouped.set(key,[...(grouped.get(key)||[]),row]);}
  return new Set([...grouped.values()].filter(group=>group.length>1).flat().map(invitationKey));
}
export function invitationsCsv(rows:InvitationRow[],duplicates:Set<string>) {
  return csvDocument([["Environment","Envelope name","Address","Address line 2","City","State","ZIP","Status","Possible duplicate","Requested by","Requester email","Requester phone","Request reference","Recipient number"],
    ...rows.map(r=>["DEVELOPMENT ONLY",r.recipient.name,r.recipient.address,r.recipient.address2,r.recipient.city,r.recipient.state,r.recipient.zip,
      invitationLabels[r.status],duplicates.has(invitationKey(r))?"REVIEW":"",r.contact.name,r.contact.email,r.contact.phone,r.request_id,r.recipient_index+1])]);
}
