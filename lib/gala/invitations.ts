import { z } from "zod";
import { contactSchema, recipientSchema, recipientsSchema, type Recipient } from "./model";
import { csvDocument } from "./csv";

export const invitationRequest = z.object({requestId:z.uuid(),contact:contactSchema,recipients:recipientsSchema}).strict();
export type InvitationRequest = z.infer<typeof invitationRequest>;
export const invitationStatus = z.enum(["requested","prepared","mailed"]);
export type InvitationStatus = z.infer<typeof invitationStatus>;
export const invitationUpdate = z.object({requestId:z.uuid(),recipientIndex:z.number().int().min(0).max(19),
  status:invitationStatus,revision:z.number().int().min(0),reason:z.string().trim().max(300).default("")}).strict();
export const invitationAddressUpdate = z.object({
  action: z.literal("address"),
  requestId: z.uuid(),
  recipientIndex: z.number().int().min(0).max(19),
  revision: z.number().int().min(0),
  recipient: recipientSchema.strict(),
  reason: z.string().trim().min(3).max(300),
}).strict();
export const invitationDuplicateUpdate = z.object({
  action: z.literal("duplicate"), decision: z.enum(["suppress", "separate", "restore"]),
  requestId: z.uuid(), recipientIndex: z.number().int().min(0).max(19), revision: z.number().int().min(0),
  targetRequestId: z.uuid().optional(), targetRecipientIndex: z.number().int().min(0).max(19).optional(),
  targetRevision: z.number().int().min(0).optional(), reason: z.string().trim().min(3).max(300),
}).strict().superRefine((value, ctx) => {
  const target = [value.targetRequestId, value.targetRecipientIndex, value.targetRevision];
  if (value.decision === "restore" ? target.some(v => v !== undefined) : target.some(v => v === undefined))
    ctx.addIssue({ code: "custom", message: "Select the other recipient for this decision." });
  if (value.requestId === value.targetRequestId && value.recipientIndex === value.targetRecipientIndex)
    ctx.addIssue({ code: "custom", message: "Select a different recipient." });
});
export const invitationPatch = z.union([invitationUpdate, invitationAddressUpdate, invitationDuplicateUpdate]);
export const invitationLabels:Record<InvitationStatus,string>={requested:"Needs preparation",prepared:"Prepared",mailed:"Mailed"};
export type InvitationRow = {request_id:string;recipient_index:number;recipient:Recipient;contact:InvitationRequest["contact"];
  status:InvitationStatus;revision:number;created_at:string;updated_at:string;
  duplicate_request_id?:string|null;duplicate_recipient_index?:number|null;separate_from?:string[]};
export const INVITATION_ATTEMPT_KEY="osg-gala-invitation-attempt-v1";
export function readInvitationAttempt(value:string|null) {return value===null?null:invitationRequest.parse(JSON.parse(value));}
export function isSuppressed(row:InvitationRow){return !!row.duplicate_request_id;}
export function filterInvitations(rows:InvitationRow[],filter:string){return rows.filter(r=>filter==="suppressed"?isSuppressed(r):!isSuppressed(r)&&(filter==="all"||r.status===filter));}
export function invitationKey(row:InvitationRow){return `${row.request_id}:${row.recipient_index}`;}
// Deliberately conservative: flag exact normalized name/address matches; never merge households.
export function duplicateCandidates(row:InvitationRow, rows:InvitationRow[]) {
  const normalize=(r:InvitationRow)=>JSON.stringify(Object.values({name:r.recipient.name,address:r.recipient.address,address2:r.recipient.address2,city:r.recipient.city,state:r.recipient.state,zip:r.recipient.zip}).map(s=>s.trim().replace(/\s+/g," ").toLowerCase()));
  return rows.filter(other=>!isSuppressed(other)&&invitationKey(other)!==invitationKey(row)&&normalize(other)===normalize(row)
    &&!row.separate_from?.includes(invitationKey(other))&&!other.separate_from?.includes(invitationKey(row)));
}
export function duplicateInvitations(rows:InvitationRow[]) {
  const grouped=new Map<string,InvitationRow[]>();
  for(const row of rows.filter(r=>!isSuppressed(r))){const r=row.recipient;
    const key=JSON.stringify([r.name,r.address,r.address2,r.city,r.state,r.zip].map(s=>s.trim().replace(/\s+/g," ").toLowerCase()));
    grouped.set(key,[...(grouped.get(key)||[]),row]);}
  return new Set([...grouped.values()].flatMap(group=>group.filter(row=>duplicateCandidates(row,group).length>0)).map(invitationKey));
}
export function invitationsCsv(rows:InvitationRow[],duplicates:Set<string>) {
  return csvDocument([["Environment","Envelope name","Address","Address line 2","City","State","ZIP","Status","Possible duplicate","Requested by","Requester email","Requester phone","Request reference","Recipient number"],
    ...rows.filter(r=>!isSuppressed(r)).map(r=>["DEVELOPMENT ONLY",r.recipient.name,r.recipient.address,r.recipient.address2,r.recipient.city,r.recipient.state,r.recipient.zip,
      invitationLabels[r.status],duplicates.has(invitationKey(r))?"REVIEW":"",r.contact.name,r.contact.email,r.contact.phone,r.request_id,r.recipient_index+1])]);
}
