import { getQuickBooksClient } from "./client";
import { QuickBooksCustomer } from "@/types/quickbooks";
import { MembershipFormData } from "@/types/membership";

/**
 * QuickBooks Customer Operations
 *
 * Handles creating and managing customers in QuickBooks Online
 */

/**
 * Search for existing customer by email
 */
export async function findCustomerByEmail(
  email: string
): Promise<QuickBooksCustomer | null> {
  const client = getQuickBooksClient();

  try {
    const query = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${email}'`;
    const response = await client.query<{
      QueryResponse: { Customer?: QuickBooksCustomer[] };
    }>(query);

    const customers = response.QueryResponse.Customer;
    return customers && customers.length > 0 ? customers[0] : null;
  } catch (error) {
    console.error("Error finding customer by email:", error);
    return null;
  }
}

/**
 * Convert membership form data to QuickBooks customer format
 */
export function membershipFormToCustomer(
  formData: MembershipFormData
): Omit<QuickBooksCustomer, "Id"> {
  return {
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
 * Create a new customer in QuickBooks
 */
export async function createCustomer(
  customerData: Omit<QuickBooksCustomer, "Id">
): Promise<QuickBooksCustomer> {
  const client = getQuickBooksClient();

  try {
    const response = await client.makeApiRequest<{
      Customer: QuickBooksCustomer;
    }>("/customer", "POST", customerData);

    return response.Customer;
  } catch (error) {
    console.error("Error creating customer:", error);
    throw new Error("Failed to create customer in QuickBooks");
  }
}

/**
 * Update existing customer in QuickBooks
 */
export async function updateCustomer(
  customer: QuickBooksCustomer
): Promise<QuickBooksCustomer> {
  const client = getQuickBooksClient();

  try {
    const response = await client.makeApiRequest<{
      Customer: QuickBooksCustomer;
    }>("/customer", "POST", customer);

    return response.Customer;
  } catch (error) {
    console.error("Error updating customer:", error);
    throw new Error("Failed to update customer in QuickBooks");
  }
}

/**
 * Create or update customer from membership form data
 *
 * This is the main function to use when processing membership submissions
 */
export async function upsertCustomerFromMembership(
  formData: MembershipFormData
): Promise<QuickBooksCustomer> {
  // Check if customer already exists
  const existingCustomer = await findCustomerByEmail(formData.email);

  if (existingCustomer) {
    // Update existing customer with new information
    const updatedData: QuickBooksCustomer = {
      ...existingCustomer,
      GivenName: formData.firstName,
      FamilyName: formData.lastName,
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

    return updateCustomer(updatedData);
  } else {
    // Create new customer
    const customerData = membershipFormToCustomer(formData);
    return createCustomer(customerData);
  }
}

/**
 * Get customer by ID
 */
export async function getCustomerById(
  customerId: string
): Promise<QuickBooksCustomer | null> {
  const client = getQuickBooksClient();

  try {
    const response = await client.makeApiRequest<{
      Customer: QuickBooksCustomer;
    }>(`/customer/${customerId}`, "GET");

    return response.Customer;
  } catch (error) {
    console.error("Error getting customer:", error);
    return null;
  }
}
