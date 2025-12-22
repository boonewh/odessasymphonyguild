import { NextRequest, NextResponse } from "next/server";
import { validateMembershipForm } from "@/lib/validation/membership";
import { getMembershipTier, FEATURE_FLAGS } from "@/lib/membership/config";
import { MembershipFormData, MembershipSubmission } from "@/types/membership";

/**
 * POST /api/membership/submit
 * Handles membership form submission
 *
 * In mock mode: Returns success without external API calls
 * In production: Creates QuickBooks Customer and Invoice
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = validateMembershipForm(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const formData: MembershipFormData = validationResult.data;

    // Verify the selected tier exists
    const tier = getMembershipTier(formData.tierId);
    if (!tier) {
      return NextResponse.json(
        { error: "Invalid membership tier selected" },
        { status: 400 }
      );
    }

    // Generate submission ID
    const submissionId = `OSG-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Create submission record
    const submission: MembershipSubmission = {
      ...formData,
      id: submissionId,
      submittedAt: new Date().toISOString(),
      status: "pending",
    };

    // Check if QuickBooks sync is enabled
    if (FEATURE_FLAGS.enableQuickBooksSync) {
      // TODO: Implement QuickBooks integration
      // 1. Create/update customer in QuickBooks
      // 2. Create invoice for membership dues
      // 3. Store QB customer and invoice IDs

      // Example (to be implemented):
      // const qbClient = new QuickBooksClient();
      // const customer = await qbClient.createCustomer({
      //   DisplayName: `${formData.firstName} ${formData.lastName}`,
      //   GivenName: formData.firstName,
      //   FamilyName: formData.lastName,
      //   PrimaryEmailAddr: { Address: formData.email },
      //   PrimaryPhone: { FreeFormNumber: formData.phone },
      //   BillAddr: formData.address ? {
      //     Line1: formData.address.street,
      //     City: formData.address.city,
      //     CountrySubDivisionCode: formData.address.state,
      //     PostalCode: formData.address.zipCode,
      //   } : undefined
      // });
      //
      // submission.quickbooksCustomerId = customer.Id;
      // submission.status = "processing";

      console.log("QuickBooks sync would be triggered here in production mode");
    } else {
      // Mock mode - simulate successful submission
      console.log("Mock mode: Membership submission received", {
        id: submissionId,
        tier: tier.name,
        member: `${formData.firstName} ${formData.lastName}`,
      });
    }

    // In production, you would:
    // 1. Store submission to database
    // 2. Send confirmation email
    // 3. Queue background job for QB sync if needed

    // For now, store to local file in mock mode (optional)
    if (FEATURE_FLAGS.mockPaymentMode) {
      // Could write to a JSON file or in-memory storage
      // await storeMockSubmission(submission);
    }

    // Return success response
    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      tier: {
        id: tier.id,
        name: tier.name,
        price: tier.price,
      },
      message: "Membership submission received successfully",
      mockMode: FEATURE_FLAGS.mockPaymentMode,
    });

  } catch (error) {
    console.error("Membership submission error:", error);

    return NextResponse.json(
      {
        error: "Failed to process membership submission",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/membership/submit
 * Returns information about the submission endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/membership/submit",
    method: "POST",
    description: "Submit membership form data",
    mockMode: FEATURE_FLAGS.mockPaymentMode,
    quickBooksEnabled: FEATURE_FLAGS.enableQuickBooksSync,
  });
}
