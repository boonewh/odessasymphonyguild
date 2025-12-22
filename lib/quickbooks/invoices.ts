import { getQuickBooksClient } from "./client";
import { QuickBooksInvoice } from "@/types/quickbooks";
import { MembershipTier } from "@/types/membership";
import { MEMBERSHIP_YEAR } from "@/lib/membership/config";

/**
 * QuickBooks Invoice Operations
 *
 * Handles creating invoices for membership dues
 */

/**
 * Create membership invoice for a customer
 *
 * @param customerId - QuickBooks customer ID
 * @param tier - Membership tier information
 * @param itemId - QuickBooks item/service ID for membership (needs to be created in QB first)
 * @returns Created invoice
 */
export async function createMembershipInvoice(
  customerId: string,
  tier: MembershipTier,
  itemId: string = "1" // Default item ID - needs to be configured in QB
): Promise<QuickBooksInvoice> {
  const client = getQuickBooksClient();

  // Calculate due date (30 days from today)
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 30);

  const invoiceData: Omit<QuickBooksInvoice, "Id"> = {
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
            value: itemId,
            name: "Membership Dues",
          },
          UnitPrice: tier.price,
          Qty: 1,
        },
      },
    ],
    DueDate: dueDate.toISOString().split("T")[0], // YYYY-MM-DD format
    TxnDate: today.toISOString().split("T")[0], // YYYY-MM-DD format
  };

  try {
    const response = await client.makeApiRequest<{
      Invoice: QuickBooksInvoice;
    }>("/invoice", "POST", invoiceData);

    return response.Invoice;
  } catch (error) {
    console.error("Error creating invoice:", error);
    throw new Error("Failed to create invoice in QuickBooks");
  }
}

/**
 * Get invoice by ID
 */
export async function getInvoiceById(
  invoiceId: string
): Promise<QuickBooksInvoice | null> {
  const client = getQuickBooksClient();

  try {
    const response = await client.makeApiRequest<{
      Invoice: QuickBooksInvoice;
    }>(`/invoice/${invoiceId}`, "GET");

    return response.Invoice;
  } catch (error) {
    console.error("Error getting invoice:", error);
    return null;
  }
}

/**
 * Get all invoices for a customer
 */
export async function getCustomerInvoices(
  customerId: string
): Promise<QuickBooksInvoice[]> {
  const client = getQuickBooksClient();

  try {
    const query = `SELECT * FROM Invoice WHERE CustomerRef = '${customerId}'`;
    const response = await client.query<{
      QueryResponse: { Invoice?: QuickBooksInvoice[] };
    }>(query);

    return response.QueryResponse.Invoice || [];
  } catch (error) {
    console.error("Error getting customer invoices:", error);
    return [];
  }
}

/**
 * Send invoice email to customer
 */
export async function sendInvoiceEmail(
  invoiceId: string,
  emailAddress: string
): Promise<boolean> {
  const client = getQuickBooksClient();

  try {
    await client.makeApiRequest(
      `/invoice/${invoiceId}/send?sendTo=${encodeURIComponent(emailAddress)}`,
      "POST"
    );

    return true;
  } catch (error) {
    console.error("Error sending invoice email:", error);
    return false;
  }
}

/**
 * Get invoice PDF
 */
export async function getInvoicePdf(invoiceId: string): Promise<Blob | null> {
  const client = getQuickBooksClient();

  try {
    // QuickBooks PDF endpoint returns PDF binary data
    const response = await client.makeApiRequest<Blob>(
      `/invoice/${invoiceId}/pdf`,
      "GET"
    );

    return response;
  } catch (error) {
    console.error("Error getting invoice PDF:", error);
    return null;
  }
}

/**
 * Check if customer has active membership invoice for current year
 */
export async function hasActiveYearMembership(
  customerId: string
): Promise<boolean> {
  const invoices = await getCustomerInvoices(customerId);

  // Check if any invoice contains current membership year in description
  return invoices.some((invoice) =>
    invoice.Line.some(
      (line) =>
        line.Description?.includes(MEMBERSHIP_YEAR.current) &&
        line.Description?.includes("Membership")
    )
  );
}
