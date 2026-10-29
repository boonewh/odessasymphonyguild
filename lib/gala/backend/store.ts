import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { databaseFetch } from "./database-fetch";
import { paymentEnvironment, type PaymentMode } from "./payment-mode";
import type { Order, OrderStore, priceRequest } from "./domain";
import { CartUnavailable, GalaSalesClosed } from "./domain";
import type { TableAssignment } from "../assignments";
import type { GiftRow, GiftStatus } from "../gift-fulfillment";
import type { InvitationRequest, InvitationRow, InvitationStatus, invitationAddressUpdate, invitationDuplicateUpdate } from "../invitations";
import type { z } from "zod";

export class SupabaseOrderStore implements OrderStore {
  private db: SupabaseClient;
  customerHash?: string;
  staffSession?: string;
  private staffMutation(name: string, args: Record<string, unknown>) {
    return this.staffSession ? this.db.rpc("gala_staff_mutation", { p_session: this.staffSession, p_operation: name, p_args: args })
      : this.db.rpc(name, args);
  }
  async invitations(): Promise<InvitationRow[]> {
    const {data,error}=await this.db.rpc("gala_invitation_list");
    if(error)throw new Error("Cannot load invitation requests.");
    return data as InvitationRow[];
  }
  async requestInvitations(details:InvitationRequest) {
    const {data,error}=await this.db.rpc(this.customerHash ? "gala_customer_invitations" : "gala_request_invitations",
      {p_details:details,...(this.customerHash ? {p_customer:this.customerHash} : {})});
    if(error)throw new Error("Invitation request not confirmed.");
    return data as string;
  }
  async setInvitationStatus(input:{requestId:string;recipientIndex:number;status:InvitationStatus;revision:number;reason:string}) {
    const {error}=await this.staffMutation("gala_set_invitation_status",{p_request:input.requestId,p_recipient:input.recipientIndex,
      p_status:input.status,p_revision:input.revision,p_reason:input.reason});
    if(error)throw new Error("Invitation status conflict.");
  }
  async setInvitationAddress(input: z.infer<typeof invitationAddressUpdate>) {
    const { error } = await this.staffMutation("gala_set_invitation_address", {
      p_request: input.requestId, p_recipient: input.recipientIndex,
      p_address: input.recipient, p_revision: input.revision, p_reason: input.reason,
    });
    if (error) throw new Error("Invitation address conflict.");
  }
  async resolveInvitationDuplicate(input: z.infer<typeof invitationDuplicateUpdate>) {
    const { error } = await this.staffMutation("gala_resolve_invitation_duplicate", {
      p_request: input.requestId, p_recipient: input.recipientIndex, p_revision: input.revision,
      p_decision: input.decision, p_target: input.targetRequestId ?? null,
      p_target_recipient: input.targetRecipientIndex ?? null, p_target_revision: input.targetRevision ?? null,
      p_reason: input.reason,
    });
    if (error) throw new Error("Duplicate decision conflict.");
  }
  constructor(url: string, secret: string, transport = databaseFetch()) {
    this.db = createClient(url, secret, { db: { retry: false }, auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: transport } });
  }
  async verifyEnvironment(mode: PaymentMode = "sandbox") {
    const expected = paymentEnvironment(mode).database;
    const { data, error } = await this.db.from("gala_environment").select("name").eq("id", 1).single();
    if (error || data?.name !== expected) throw new Error("Gala database marker is missing or does not match.");
  }
  async assignments(): Promise<TableAssignment[]> {
    const { data, error } = await this.db.rpc("gala_assignment_list");
    if (error) throw new Error("Cannot load table assignments.");
    return data as TableAssignment[];
  }
  async gifts(): Promise<GiftRow[]> {
    const {data,error}=await this.db.rpc("gala_gift_list");
    if(error) throw new Error("Cannot load paid gifts.");
    return data as GiftRow[];
  }
  async setGiftStatus(input:{orderId:string;recipientIndex:number;status:GiftStatus;revision:number;reason:string}) {
    const {error}=await this.staffMutation("gala_set_gift_status",{p_order:input.orderId,p_recipient:input.recipientIndex,
      p_status:input.status,p_revision:input.revision,p_reason:input.reason});
    if(error) throw new Error("Gift fulfillment conflict or invalid update.");
  }
  async assignTable(input: {orderId: string; tableNumber: number | null; revision: number; lineIndex?: number}) {
    const args = {p_order: input.orderId, p_number: input.tableNumber, p_revision: input.revision, p_line: input.lineIndex ?? 0};
    const { error } = this.staffSession ? await this.staffMutation("gala_assign_table", args) : await this.db.rpc("gala_assign_table_line", args);
    if (error) throw new Error("Table assignment conflict or invalid order.");
  }
  private async rpc(name: string, args: Record<string, unknown>): Promise<Order> {
    const { data, error } = await this.db.rpc(name, args);
    // Do not echo provider errors: they can include customer data or implementation details.
    if (error?.code === "P0001" && ["Gala sales closed for final accounting", "Gala submissions are closed"].includes(error.message)) throw new GalaSalesClosed();
    if ((name === "gala_reserve" || name === "gala_customer_reserve") && error?.code === "P0001"
      && error.message === "Table tier sold out or reserved") throw new CartUnavailable();
    if (error) throw new Error(`Gala database operation failed: ${name}`);
    return data as Order;
  }
  reserve(quote: ReturnType<typeof priceRequest>) {
    return this.rpc(this.customerHash ? "gala_customer_reserve" : "gala_reserve", { ...(this.customerHash ? {p_customer:this.customerHash} : {}), p_id: quote.details.requestId, p_hash: quote.hash,
      p_details: quote.details, p_amount: quote.amount, p_description: quote.description, p_tier: quote.tier });
  }
  async get(id: string): Promise<Order> {
    let query = this.db.from("gala_orders").select("*").eq("id", id);
    if (this.customerHash) query = query.eq("customer_hash", this.customerHash);
    const { data, error } = await query.single();
    if (error) throw new Error("Gala order not found.");
    return data as Order;
  }
  bind(id: string, sessionId: string) {
    return this.rpc("gala_bind_checkout", { p_id: id, p_session: sessionId });
  }
  apply(id: string, sessionId: string, state: "paid" | "expired", paymentId: string | null, eventId: string) {
    return this.rpc("gala_apply_payment", { p_id: id, p_session: sessionId, p_state: state, p_payment: paymentId, p_event: eventId });
  }
  async pending(): Promise<Order[]> {
    const { data, error } = await this.db.from("gala_orders").select("*")
      .in("status", ["reserved", "awaiting_payment"]).order("created_at").limit(100);
    if (error) throw new Error("Cannot load pending Gala orders.");
    return data as Order[];
  }
  async dashboard() {
    const [orders, inventory] = await Promise.all([
      this.db.from("gala_orders").select("*").order("created_at", { ascending: false }).limit(100),
      this.db.rpc("gala_inventory_counts"),
    ]);
    if (orders.error || inventory.error) throw new Error("Cannot load Gala dashboard.");
    return { orders: orders.data as Order[], inventory: inventory.data };
  }

  async ledgerSnapshot(): Promise<unknown> {
    const { data, error } = await this.db.rpc("gala_ledger_snapshot");
    if (error || !data) throw new Error("Cannot load the complete Gala ledger.");
    return data;
  }
}
