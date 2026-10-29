import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    // These existing mount effects hydrate browser storage or start an async
    // provider read. Keep the performance advisory visible without rewriting
    // payment/session lifecycles during the dependency security update.
    files: [
      "components/gala/{GalaCart,GalaLedger,GiftFulfillment,InvitationMailing,PaymentLab,PaymentRecovery,SandboxCheckout,SandboxInvitations,TableAssignments}.tsx",
      "components/patron/{PatronAdmin,PatronPaymentStatus}.tsx",
    ],
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
  {
    files: ["merge-prompt.js"],
    // This standalone Node script intentionally uses CommonJS and __dirname.
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  globalIgnores([
    ".next/**", "out/**", "build/**", "next-env.d.ts",
    ".codex-remote-attachments/**", "agents/**",
  ]),
]);
