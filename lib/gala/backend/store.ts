import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Order, OrderStore, priceRequest } from "./domain";

export class SupabaseOrderStore implements OrderStore {
  private db: SupabaseClient;
  constructor(url: string, secret: string) {
    this.db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  async verifyEnvironment() {
    const { data, error } = await this.db.from("gala_environment").select("name").eq("id", 1).single();
    if (error || data?.name !== "osg-gala-development") throw new Error("Development database marker is missing.");
  }
  private async rpc(name: string, args: Record<string, unknown>): Promise<Order> {
    const { data, error } = await this.db.rpc(name, args);
    // Do not echo provider errors: they can include customer data or implementation details.
    if (error) throw new Error(`Gala database operation failed: ${name}`);
    return data as Order;
  }
  reserve(quote: ReturnType<typeof priceRequest>) {
    return this.rpc("gala_reserve", { p_id: quote.details.requestId, p_hash: quote.hash,
      p_details: quote.details, p_amount: quote.amount, p_description: quote.description, p_tier: quote.tier });
  }
  async get(id: string): Promise<Order> {
    const { data, error } = await this.db.from("gala_orders").select("*").eq("id", id).single();
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
}
