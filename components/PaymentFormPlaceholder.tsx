"use client";

import { FEATURE_FLAGS } from "@/lib/membership/config";

interface PaymentFormPlaceholderProps {
  amount: number;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

export default function PaymentFormPlaceholder({
  amount,
  onSubmit,
  isSubmitting = false,
}: PaymentFormPlaceholderProps) {
  const isMockMode = FEATURE_FLAGS.mockPaymentMode;

  return (
    <div className="max-w-2xl mx-auto">
      {isMockMode && (
        <div className="mb-6 bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">
                Demo Mode Active
              </h3>
              <p className="text-sm text-yellow-800 leading-relaxed">
                This is a demonstration of the membership payment form. No
                actual payment will be processed. The payment integration will
                be activated when the real QuickBooks credentials are
                configured.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border-2 border-gray-300 p-6">
        <h3 className="text-2xl font-light mb-6 text-[#1a1a2e]">
          Payment Information
        </h3>

        {/* Order Summary */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-700">Annual Membership</span>
            <span className="text-lg font-semibold text-[#1a1a2e]">
              ${amount.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>Tax-deductible contribution</span>
            <span className="text-[#d4af37]">✓</span>
          </div>
        </div>

        {/* Mock Payment Fields */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Card Number
            </label>
            <input
              type="text"
              placeholder="4242 4242 4242 4242"
              disabled={isMockMode}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expiration Date
              </label>
              <input
                type="text"
                placeholder="MM / YY"
                disabled={isMockMode}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CVC
              </label>
              <input
                type="text"
                placeholder="123"
                disabled={isMockMode}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cardholder Name
            </label>
            <input
              type="text"
              placeholder="John Doe"
              disabled={isMockMode}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Security Notice */}
        <div className="mb-6 flex items-start gap-2 text-sm text-gray-600">
          <span className="text-green-600">🔒</span>
          <p>
            Your payment information is encrypted and secure. We never store
            your credit card details.
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="w-full bg-[#d4af37] text-[#1a1a2e] py-4 rounded-lg font-semibold text-lg hover:bg-[#c19b2e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span>
              Processing...
            </span>
          ) : (
            <span>
              {isMockMode
                ? "Complete Demo Membership"
                : `Pay $${amount.toFixed(2)}`}
            </span>
          )}
        </button>

        {isMockMode && (
          <p className="mt-4 text-center text-sm text-gray-600">
            In demo mode, clicking the button above will show the confirmation
            page without processing payment.
          </p>
        )}
      </div>

      {/* Tax Deduction Notice */}
      <div className="mt-6 text-center text-sm text-gray-600">
        <p>
          The Odessa Symphony Guild is a 501(c)(3) nonprofit organization.
          <br />
          Your membership contribution is tax-deductible to the extent allowed
          by law.
        </p>
      </div>
    </div>
  );
}
