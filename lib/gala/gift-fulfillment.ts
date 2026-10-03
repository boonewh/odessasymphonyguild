import { z } from "zod";
import { csvDocument } from "./csv";
export const giftStatus = z.enum(["pending","prepared","delivered"]);
export type GiftStatus = z.infer<typeof giftStatus>;
export const giftUpdate = z.object({orderId:z.uuid(),recipientIndex:z.number().int().min(0).max(19),
  status:giftStatus,revision:z.number().int().min(0),reason:z.string().trim().max(300).default("")}).strict();
export type GiftRow = {order_id:string;recipient_index:number;buyer:{name:string;email:string;phone:string};
  student:string;grade:string;roses:number;cookies:number;status:GiftStatus;revision:number};
export const giftLabels: Record<GiftStatus,string> = {pending:"Needs preparation",prepared:"Prepared",delivered:"Handed out"};
export function filterGifts(rows:GiftRow[],filter:string) { return rows.filter(r=>filter==="all"||r.status===filter); }
export function giftTotals(rows:GiftRow[]) {
  return rows.reduce((sum,r)=>({recipients:sum.recipients+1,roses:sum.roses+r.roses,cookies:sum.cookies+r.cookies}),{recipients:0,roses:0,cookies:0});
}
export function giftsCsv(rows:GiftRow[]) {
  return csvDocument([["Environment","Student","Grade","Roses","Cookie bags (2 cookies each)","Status","Purchased by","Email","Phone","Order reference","Recipient number"],
    ...rows.map(r=>["DEVELOPMENT ONLY",r.student,r.grade,r.roses,r.cookies,giftLabels[r.status],r.buyer.name,r.buyer.email,r.buyer.phone,r.order_id,r.recipient_index+1])]);
}
