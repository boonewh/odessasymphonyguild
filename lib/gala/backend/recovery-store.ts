import { createClient } from "@supabase/supabase-js";
import { databaseFetch } from "./database-fetch";
import type { Order } from "./domain";
import type { RecoveryOutcome, RecoveryStore } from "./recovery";
export class SupabaseRecoveryStore implements RecoveryStore {
  private db;
  staffSession?:string;
  constructor(url:string,key:string,transport=databaseFetch()){this.db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:transport}});}
  private async rpc(name:string,args:Record<string,unknown>={}){
    const {data,error}=await this.db.rpc(name,args);if(error)throw new Error('Recovery database operation unavailable.');return data;
  }
  async claim(token:string):Promise<Order|null>{return this.rpc('gala_claim_recovery',{p_token:token});}
  async finish(orderId:string,token:string,outcome:RecoveryOutcome){await this.rpc('gala_finish_recovery',{p_order:orderId,p_token:token,p_outcome:outcome});}
  async retry(orderId:string,reason:string){const args={p_order:orderId,p_reason:reason};
    if(this.staffSession) await this.rpc('gala_staff_mutation',{p_session:this.staffSession,p_operation:'gala_retry_recovery',p_args:args});
    else await this.rpc('gala_retry_recovery',args);}
  dashboard(){return this.rpc('gala_recovery_dashboard');}
}
