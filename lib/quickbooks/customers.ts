import { getQuickBooksClient } from "./client";
import { QuickBooksCustomer } from "@/types/quickbooks";

export interface CustomerInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

/**
 * Find existing QB customer by email, or create a new one.
 */
export async function findOrCreateCustomer(
  input: CustomerInput
): Promise<QuickBooksCustomer> {
  const client = getQuickBooksClient();

  const query = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${input.email}' MAXRESULTS 1`;
  const searchResult = await client.query<{
    QueryResponse: { Customer?: QuickBooksCustomer[] };
  }>(query);

  const existing = searchResult.QueryResponse.Customer?.[0];
  if (existing) return existing;

  const customerData = {
    GivenName: input.firstName,
    FamilyName: input.lastName,
    DisplayName: `${input.firstName} ${input.lastName}`,
    PrimaryEmailAddr: { Address: input.email },
    ...(input.phone && { PrimaryPhone: { FreeFormNumber: input.phone } }),
  };

  const response = await client.makeApiRequest<{
    Customer: QuickBooksCustomer;
  }>("/customer", "POST", customerData);

  return response.Customer;
}
