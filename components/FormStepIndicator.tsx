import { FormStep } from "@/types/membership";

interface FormStepIndicatorProps {
  currentStep: FormStep;
}

const steps: { id: FormStep; label: string }[] = [
  { id: "tier", label: "Select Tier" },
  { id: "info", label: "Your Information" },
  { id: "payment", label: "Payment" },
  { id: "confirmation", label: "Confirmation" },
];

export default function FormStepIndicator({
  currentStep,
}: FormStepIndicatorProps) {
  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isUpcoming = index > currentStepIndex;

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step Circle */}
              <div className="flex flex-col items-center relative flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                    isCompleted
                      ? "bg-[#d4af37] text-[#1a1a2e]"
                      : isCurrent
                      ? "bg-[#d4af37] text-[#1a1a2e] ring-4 ring-[#d4af37]/30"
                      : "bg-gray-300 text-gray-600"
                  }`}
                >
                  {isCompleted ? "✓" : index + 1}
                </div>
                <span
                  className={`mt-2 text-xs sm:text-sm font-medium text-center ${
                    isCurrent
                      ? "text-[#1a1a2e]"
                      : isCompleted
                      ? "text-[#d4af37]"
                      : "text-gray-500"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div
                  className={`h-1 flex-1 -mt-8 transition-all ${
                    isCompleted ? "bg-[#d4af37]" : "bg-gray-300"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
