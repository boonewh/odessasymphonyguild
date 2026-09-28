"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { orderSchema, remainingTables, transitionDemoOrder, type DemoOrder, type OrderStatus, type Tier } from "./model";

const KEY = "osg-gala-local-preview-v1";
const EVENT = "osg-gala-preview-changed";
function read(): DemoOrder[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  const result = z.array(orderSchema).safeParse(JSON.parse(raw));
  if (!result.success) throw new Error("Preview data is incompatible. Clear the local preview data to restart.");
  return result.data;
}
function write(orders: DemoOrder[]) {
  localStorage.setItem(KEY, JSON.stringify(orders));
  window.dispatchEvent(new Event(EVENT));
}
// Local review adapter only. Production must use transactional server-side
// reservations, verified Stripe events, durable orders, and reconciliation.
export function useDemoOrders() {
  const [orders, setOrders] = useState<DemoOrder[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    function refresh() {
      try { setOrders(read()); setError(""); setReady(true); }
      catch { setError("Local preview storage is unavailable or invalid. No order was saved."); setReady(false); }
    }
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, []);
  function add(order: DemoOrder) {
    const current = read();
    if (current.some((item) => item.id === order.id)) return;
    const product = order.purchase?.product;
    if (product && ["platinum", "gold", "silver"].includes(product) && remainingTables(current, product as Tier) === 0) {
      throw new Error("No preview tables remain in that tier.");
    }
    write([orderSchema.parse(order), ...current]);
  }
  function update(id: string, status: OrderStatus) {
    write(read().map((order) => order.id === id ? transitionDemoOrder(order, status) : order));
  }
  function assign(id: string, tableAssignment: string) {
    write(read().map((order) => order.id === id ? orderSchema.parse({ ...order, tableAssignment }) : order));
  }
  function clear() { localStorage.removeItem(KEY); window.dispatchEvent(new Event(EVENT)); }
  return { orders, ready, error, add, update, assign, clear };
}
