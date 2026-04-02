import { getQuickBooksClient } from "./client";
import { QuickBooksInvoice } from "@/types/quickbooks";

export interface InvoiceInput {
  customerId: string;
  amount: number;
  description: string;
  itemId?: string; // QB item/service ID — must exist in QB account
}

/**
 * Create a QB invoice and return it along with the hosted payment link.
 * Requires QB Payments to be enabled on the account for InvoiceLink to populate.
 */
export async function createInvoice(
  input: InvoiceInput
): Promise<QuickBooksInvoice> {
  const client = getQuickBooksClient();

  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 30);

  const invoiceData: Omit<QuickBooksInvoice, "Id"> = {
    CustomerRef: { value: input.customerId },
    Line: [
      {
        Amount: input.amount,
        Description: input.description,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: {
            value: input.itemId ?? "1",
            name: "Dues",
          },
          UnitPrice: input.amount,
          Qty: 1,
        },
      },
    ],
    DueDate: dueDate.toISOString().split("T")[0],
    TxnDate: today.toISOString().split("T")[0],
  };

  const response = await client.makeApiRequest<{
    Invoice: QuickBooksInvoice;
  }>("/invoice", "POST", invoiceData);

  return response.Invoice;
}

/**
 * Send invoice email to an additional address beyond the primary QB customer email.
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
