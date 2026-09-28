import { z } from "zod";

export const EVENT = {
  name: "Odessa Symphony Ball 2027",
  date: "February 27, 2027",
  venue: "La Hacienda",
  refundPolicy: "All sales are final. No refunds.",
} as const;

// Development fixtures, NEVER a production inventory seed.
export const PREVIEW_CAPACITY = { platinum: 20, gold: 20, silver: 20 } as const;
export const RELEASE = {
  inventoryConfirmed: false,
  paymentTestingComplete: false,
  accountingReviewed: false,
  launchAuthorized: false,
} as const;

export function previewAllowed(nodeEnv: string | undefined, vercelEnv?: string) {
  return nodeEnv === "development" && !vercelEnv;
}

export const TABLES = [
  { id: "platinum", name: "Platinum table", price: 550000, extra: 68750,
    description: "The ultimate Gala experience",
    benefits: ["VIP seating for 8 guests", "Premier table location", "Champagne service", "Full charcuterie board", "Elegant table favors"] },
  { id: "gold", name: "Gold table", price: 350000, extra: 43750,
    description: "An elevated evening",
    benefits: ["Seating for 8 guests", "Upgraded table location", "Charcuterie cups", "Elegant table favors"] },
  { id: "silver", name: "Silver table", price: 200000, extra: 25000,
    description: "A beautiful night out",
    benefits: ["Seating for 8 guests", "Sweet treat", "Elegant table favors"] },
] as const;
export type Tier = (typeof TABLES)[number]["id"];
export type Product = Tier | "couples" | "student-date";

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  email: z.email("Please enter a valid email address.").max(254),
  phone: z.string().trim().min(7, "Please enter a phone number.").max(30),
});
export const purchaseSchema = z.object({
  product: z.enum(["platinum", "gold", "silver", "couples", "student-date"]),
  quantity: z.number().int().min(1).max(10),
  extraSeats: z.number().int().min(0).max(2),
}).superRefine((value, ctx) => {
  const table = TABLES.some((item) => item.id === value.product);
  if (table && value.quantity !== 1) ctx.addIssue({ code: "custom", message: "Preview orders support one table at a time." });
  if (!table && value.extraSeats !== 0) ctx.addIssue({ code: "custom", message: "Extra seats apply only to tables." });
});
export type Purchase = z.infer<typeof purchaseSchema>;
export function quotePurchase(input: Purchase) {
  const value = purchaseSchema.parse(input);
  const table = TABLES.find((item) => item.id === value.product);
  if (table) return { total: table.price + table.extra * value.extraSeats, seats: 8 + value.extraSeats,
    description: `${table.name}${value.extraSeats ? ` + ${value.extraSeats} extra seat${value.extraSeats === 1 ? "" : "s"}` : ""}` };
  return { total: (value.product === "couples" ? 30000 : 10000) * value.quantity,
    seats: (value.product === "couples" ? 2 : 1) * value.quantity,
    description: `${value.quantity} × ${value.product === "couples" ? "Couples ticket" : "Student date ticket"}` };
}

export const giftSchema = z.object({
  student: z.string().trim().min(2, "Enter the student's name.").max(120),
  grade: z.enum(["9", "10", "11", "12"]),
  roses: z.number().int().min(0).max(50),
  cookies: z.number().int().min(0).max(50),
}).refine((value) => value.roses + value.cookies > 0, "Choose at least one gift for each student.");
export const giftsSchema = z.array(giftSchema).min(1).max(20);
export type Gift = z.infer<typeof giftSchema>;
export function quoteGifts(gifts: Gift[]) {
  return giftsSchema.parse(gifts).reduce((total, gift) => total + (gift.roses + gift.cookies) * 1000, 0);
}
export const recipientSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(3).max(200),
  address2: z.string().trim().max(120),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().regex(/^[A-Za-z]{2}$/, "Use a two-letter state abbreviation."),
  zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Enter a ZIP code."),
});
export const recipientsSchema = z.array(recipientSchema).min(1).max(20);
export type Recipient = z.infer<typeof recipientSchema>;
export const orderSchema = z.object({
  id: z.string(), createdAt: z.string(), demo: z.literal(true),
  kind: z.enum(["tables", "gifts", "invitations"]),
  status: z.enum(["awaiting_payment", "paid", "expired", "requested", "prepared", "mailed"]),
  contact: contactSchema,
  total: z.number().int().nonnegative(), description: z.string(),
  purchase: purchaseSchema.optional(), gifts: giftsSchema.optional(), recipients: recipientsSchema.optional(),
  tableAssignment: z.string().max(100).default(""),
});
export type DemoOrder = z.infer<typeof orderSchema>;
export type OrderStatus = DemoOrder["status"];
export function remainingTables(orders: DemoOrder[], tier: Tier) {
  return Math.max(0, PREVIEW_CAPACITY[tier] - orders.filter((order) =>
    order.purchase?.product === tier && ["awaiting_payment", "paid"].includes(order.status)).length);
}
export function transitionDemoOrder(order: DemoOrder, status: OrderStatus): DemoOrder {
  const allowed = order.kind === "invitations"
    ? (order.status === "requested" && status === "prepared") || (order.status === "prepared" && status === "mailed")
    : order.status === "awaiting_payment" && (status === "paid" || status === "expired");
  if (!allowed) throw new Error("This status change is not allowed.");
  return { ...order, status };
}
export const STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: "Awaiting payment", paid: "Paid", expired: "Expired — unpaid",
  requested: "Requested", prepared: "Prepared", mailed: "Mailed",
};
export function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}
