"use client";

import { MembershipTier } from "@/types/membership";
import { MEMBERSHIP_TIERS } from "@/lib/membership/config";

interface MembershipTierSelectorProps {
  selectedTierId: string;
  onSelectTier: (tierId: string) => void;
}

export default function MembershipTierSelector({
  selectedTierId,
  onSelectTier,
}: MembershipTierSelectorProps) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {MEMBERSHIP_TIERS.map((tier) => {
        const isSelected = tier.id === selectedTierId;

        return (
          <button
            key={tier.id}
            type="button"
            onClick={() => onSelectTier(tier.id)}
            className={`relative bg-white rounded-lg border-2 p-6 text-left transition-all hover:shadow-lg ${
              isSelected
                ? "border-[#d4af37] shadow-lg ring-4 ring-[#d4af37]/30"
                : "border-gray-300 hover:border-[#d4af37]/50"
            }`}
          >
            {tier.popular && (
              <div className="absolute top-0 right-0 bg-[#d4af37] text-[#1a1a2e] px-3 py-1 text-xs font-semibold rounded-bl-lg">
                Most Popular
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-2xl font-light mb-2 text-[#1a1a2e] tracking-wide">
                {tier.name}
              </h3>
              <div className="mb-3">
                <span className="text-3xl font-bold text-[#d4af37]">
                  ${tier.price}
                </span>
                <span className="text-gray-600 text-sm">/year</span>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed">
                {tier.description}
              </p>
            </div>

            <div className="mb-4">
              <h4 className="font-semibold text-[#1a1a2e] mb-2 text-xs uppercase tracking-wider">
                Benefits Include:
              </h4>
              <ul className="space-y-1">
                {tier.benefits.slice(0, 3).map((benefit, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <span className="text-[#d4af37] mt-0.5">✓</span>
                    <span>{benefit}</span>
                  </li>
                ))}
                {tier.benefits.length > 3 && (
                  <li className="text-sm text-gray-500 italic">
                    + {tier.benefits.length - 3} more benefits
                  </li>
                )}
              </ul>
            </div>

            <div
              className={`flex items-center justify-center gap-2 py-2 rounded font-semibold text-sm ${
                isSelected
                  ? "bg-[#d4af37] text-[#1a1a2e]"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {isSelected ? (
                <>
                  <span>✓</span>
                  <span>Selected</span>
                </>
              ) : (
                <span>Select This Tier</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
