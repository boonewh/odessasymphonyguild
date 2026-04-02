import { QuickBooksCustomer, QuickBooksInvoice } from "@/types/quickbooks";
import { CustomerInput } from "./customers";
import { InvoiceInput } from "./invoices";

/**
 * Mock QuickBooks client for development/testing without real QB credentials.
 */
export class MockQuickBooksClient {
  private customers: Map<string, QuickBooksCustomer> = new Map();
  private invoices: Map<string, QuickBooksInvoice> = new Map();

  async findOrCreateCustomer(
    input: CustomerInput
  ): Promise<QuickBooksCustomer> {
    await this.delay(300);

    for (const c of this.customers.values()) {
      if (c.PrimaryEmailAddr.Address === input.email) {
        console.log("[MOCK QB] Found existing customer:", c.Id);
        return c;
      }
    }

    const customer: QuickBooksCustomer = {
      Id: `MOCK-CUST-${Date.now()}`,
      DisplayName: `${input.firstName} ${input.lastName}`,
      GivenName: input.firstName,
      FamilyName: input.lastName,
      PrimaryEmailAddr: { Address: input.email },
      ...(input.phone && { PrimaryPhone: { FreeFormNumber: input.phone } }),
    };

    this.customers.set(customer.Id!, customer);
    console.log("[MOCK QB] Created customer:", customer.Id);
    return customer;
  }

  async createInvoice(input: InvoiceInput): Promise<QuickBooksInvoice & { InvoiceLink?: string }> {
    await this.delay(400);

    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 30);

    const invoice: QuickBooksInvoice & { InvoiceLink?: string } = {
      Id: `MOCK-INV-${Date.now()}`,
      CustomerRef: { value: input.customerId },
      Line: [
        {
          Amount: input.amount,
          Description: input.description,
          DetailType: "SalesItemLineDetail",
          SalesItemLineDetail: {
            ItemRef: { value: input.itemId ?? "1", name: "Dues" },
            UnitPrice: input.amount,
            Qty: 1,
          },
        },
      ],
      DueDate: dueDate.toISOString().split("T")[0],
      TxnDate: today.toISOString().split("T")[0],
      InvoiceLink: "https://example.com/mock-payment-link",
    };

    this.invoices.set(invoice.Id!, invoice);
    console.log("[MOCK QB] Created invoice:", invoice.Id, `$${input.amount}`);
    return invoice;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

let mockClientInstance: MockQuickBooksClient | null = null;

export function getMockQuickBooksClient(): MockQuickBooksClient {
  if (!mockClientInstance) {
    mockClientInstance = new MockQuickBooksClient();
  }
  return mockClientInstance;
}
