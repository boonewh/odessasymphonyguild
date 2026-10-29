// Isolated provider used only by the bundled live-recovery route rehearsal.
import assert from "node:assert/strict";
export const fixture = {
  account: "acct_1UPo5fKdKFOoaTnc",
  accountReads: 0, sessionReads: 0, paymentReads: 0, expires: 0,
  providerDown: false,
  session: {} as Record<string, unknown>,
  payment: {} as Record<string, unknown>,
};
export default class FictionalStripe {
  constructor(key: string) { assert.equal(key, "sk_live_offline"); }
  accounts = { retrieveCurrent: async () => {
    fixture.accountReads++;
    if (fixture.providerDown) throw new Error("Fictional provider outage");
    return { id: fixture.account };
  } };
  checkout = { sessions: {
    retrieve: async (id: string) => {
      fixture.sessionReads++; assert.equal(id, fixture.session.id);
      return fixture.session;
    },
    expire: async (id: string) => {
      fixture.expires++; assert.equal(id, fixture.session.id);
      fixture.session = { ...fixture.session, status: "expired", payment_status: "unpaid" };
      return fixture.session;
    },
  } };
  paymentIntents = { retrieve: async (id: string) => {
    fixture.paymentReads++; assert.equal(id, fixture.payment.id);
    return fixture.payment;
  } };
}
