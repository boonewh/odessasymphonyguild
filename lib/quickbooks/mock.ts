import {
  QuickBooksCustomer,
  QuickBooksInvoice,
  QuickBooksCompanyInfo,
} from "@/types/quickbooks";
import { MembershipFormData, MembershipTier } from "@/types/membership";
import { MEMBERSHIP_YEAR } from "@/lib/membership/config";

/**
 * Mock QuickBooks API Responses
 *
 * Provides realistic mock data for testing without real QuickBooks connection
 */

/**
 * Generate mock customer from membership form data
 */
export function generateMockCustomer(
  formData: MembershipFormData
): QuickBooksCustomer {
  return {
    Id: `MOCK-CUST-${Date.now()}`,
    DisplayName: `${formData.firstName} ${formData.lastName}`,
    GivenName: formData.firstName,
    FamilyName: formData.lastName,
    PrimaryEmailAddr: {
      Address: formData.email,
    },
    PrimaryPhone: {
      FreeFormNumber: formData.phone,
    },
    ...(formData.address && {
      BillAddr: {
        Line1: formData.address.street,
        City: formData.address.city,
        CountrySubDivisionCode: formData.address.state,
        PostalCode: formData.address.zipCode,
      },
    }),
  };
}

/**
 * Generate mock invoice for membership
 */
export function generateMockInvoice(
  customerId: string,
  tier: MembershipTier
): QuickBooksInvoice {
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 30);

  return {
    Id: `MOCK-INV-${Date.now()}`,
    CustomerRef: {
      value: customerId,
    },
    Line: [
      {
        Amount: tier.price,
        Description: `${tier.name} Membership - ${MEMBERSHIP_YEAR.current}`,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: {
            value: "MOCK-ITEM-1",
            name: "Membership Dues",
          },
          UnitPrice: tier.price,
          Qty: 1,
        },
      },
    ],
    DueDate: dueDate.toISOString().split("T")[0],
    TxnDate: today.toISOString().split("T")[0],
  };
}

/**
 * Generate mock company info
 */
export function generateMockCompanyInfo(): QuickBooksCompanyInfo {
  return {
    CompanyName: "Odessa Symphony Guild (Demo)",
    CompanyAddr: {
      City: "Odessa",
      Country: "US",
      Line1: "123 Symphony Lane",
      PostalCode: "79761",
      CountrySubDivisionCode: "TX",
    },
    Email: {
      Address: "demo@odessasymphonyguild.org",
    },
  };
}

/**
 * Mock QuickBooks Client for testing
 *
 * Simulates QuickBooks API without making real API calls
 */
export class MockQuickBooksClient {
  private customers: Map<string, QuickBooksCustomer> = new Map();
  private invoices: Map<string, QuickBooksInvoice> = new Map();

  async createCustomer(
    formData: MembershipFormData
  ): Promise<QuickBooksCustomer> {
    // Simulate API delay
    await this.delay(300);

    const customer = generateMockCustomer(formData);
    this.customers.set(customer.Id!, customer);

    console.log("[MOCK QB] Created customer:", customer.Id);
    return customer;
  }

  async findCustomerByEmail(
    email: string
  ): Promise<QuickBooksCustomer | null> {
    await this.delay(200);

    for (const customer of this.customers.values()) {
      if (customer.PrimaryEmailAddr.Address === email) {
        console.log("[MOCK QB] Found existing customer:", customer.Id);
        return customer;
      }
    }

    console.log("[MOCK QB] No customer found with email:", email);
    return null;
  }

  async createInvoice(
    customerId: string,
    tier: MembershipTier
  ): Promise<QuickBooksInvoice> {
    await this.delay(400);

    const invoice = generateMockInvoice(customerId, tier);
    this.invoices.set(invoice.Id!, invoice);

    console.log("[MOCK QB] Created invoice:", invoice.Id);
    return invoice;
  }

  async getCompanyInfo(): Promise<QuickBooksCompanyInfo> {
    await this.delay(150);

    console.log("[MOCK QB] Retrieved company info");
    return generateMockCompanyInfo();
  }

  async getCustomerById(customerId: string): Promise<QuickBooksCustomer | null> {
    await this.delay(200);

    const customer = this.customers.get(customerId);
    console.log(
      "[MOCK QB] Get customer by ID:",
      customerId,
      customer ? "found" : "not found"
    );
    return customer || null;
  }

  async getInvoiceById(invoiceId: string): Promise<QuickBooksInvoice | null> {
    await this.delay(200);

    const invoice = this.invoices.get(invoiceId);
    console.log(
      "[MOCK QB] Get invoice by ID:",
      invoiceId,
      invoice ? "found" : "not found"
    );
    return invoice || null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get all mock data (for debugging)
   */
  getAllData() {
    return {
      customers: Array.from(this.customers.values()),
      invoices: Array.from(this.invoices.values()),
    };
  }

  /**
   * Clear all mock data
   */
  clear() {
    this.customers.clear();
    this.invoices.clear();
    console.log("[MOCK QB] Cleared all mock data");
  }
}

/**
 * Singleton instance of mock client
 */
let mockClientInstance: MockQuickBooksClient | null = null;

export function getMockQuickBooksClient(): MockQuickBooksClient {
  if (!mockClientInstance) {
    mockClientInstance = new MockQuickBooksClient();
  }
  return mockClientInstance;
}
