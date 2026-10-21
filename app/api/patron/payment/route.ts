import { patronPaymentRoutes } from "@/lib/patron/payment-server";
export const runtime = "nodejs";
export const maxDuration = 120;
export const POST = patronPaymentRoutes.status;
