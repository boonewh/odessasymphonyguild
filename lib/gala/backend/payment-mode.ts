// Server-selected payment identity. Never infer this from a request, webhook,
// Checkout Session or key supplied by a buyer. Production routes remain closed.
export type PaymentMode = "sandbox" | "live";
const environments = {
  sandbox: Object.freeze({ livemode: false, application: "osg-gala-development", account: "acct_1UPo5p46WzPrgtpT" }),
  live: Object.freeze({ livemode: true, application: "osg-gala-2027", account: "acct_1UPo5fKdKFOoaTnc" }),
} as const;

export function paymentEnvironment(mode: PaymentMode) {
  if (mode !== "sandbox" && mode !== "live") throw new Error("Unknown Gala payment environment.");
  return environments[mode];
}

export function verifyStripeAccount(accountId: string, mode: PaymentMode) {
  if (accountId !== paymentEnvironment(mode).account) throw new Error("Unexpected Gala Stripe account.");
}
