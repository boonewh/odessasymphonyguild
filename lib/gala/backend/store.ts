import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Order, OrderStore, priceRequest } from "./domain";
import type { TableAssignment } from "../assignments";

export class SupabaseOrderStore implements OrderStore {
  private db: SupabaseClient;
  constructor(url: string, secret: string) {
    this.db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  async verifyEnvironment() {
    const { data, error } = await this.db.from("gala_environment").select("name").eq("id", 1).single();
    if (error || data?.name !== "osg-gala-development") throw new Error("Development database marker is missing.");
  }
  async assignments(): Promise<TableAssignment[]> {
    const { data, error } = await this.db.rpc("gala_assignment_list");
    if (error) throw new Error("Cannot load table assignments.");
    return data as TableAssignment[];
  }
  async assignTable(input: {orderId: string; tableNumber: number | null; revision: number}) {
    const { error } = await this.db.rpc("gala_assign_table", {p_order: input.orderId, p_number: input.tableNumber, p_revision: input.revision});
    if (error) throw new Error("Table assignment conflict or invalid order.");
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
  async dashboard() {
    const [orders, inventory, outbox] = await Promise.all([
      this.db.from("gala_orders").select("*").order("created_at", { ascending: false }).limit(100),
      this.db.from("gala_inventory").select("tier,capacity,board_confirmed"),
      this.db.from("gala_accounting_outbox").select("order_id,status").limit(1000),
    ]);
    if (orders.error || inventory.error || outbox.error) throw new Error("Cannot load Gala dashboard.");
    const counts = await Promise.all(inventory.data.map(async tier => {
      const [held, paid] = await Promise.all([
        this.db.from("gala_orders").select("id", { count: "exact", head: true }).eq("tier", tier.tier).in("status", ["reserved", "awaiting_payment"]),
        this.db.from("gala_orders").select("id", { count: "exact", head: true }).eq("tier", tier.tier).eq("status", "paid"),
      ]);
      if (held.error || paid.error) throw new Error("Cannot read inventory counts.");
      return { ...tier, held: held.count || 0, paid: paid.count || 0,
        available: Math.max(0, tier.capacity - (held.count || 0) - (paid.count || 0)) };
    }));
    return { orders: orders.data as Order[], inventory: counts, accounting: outbox.data };
  }
}
