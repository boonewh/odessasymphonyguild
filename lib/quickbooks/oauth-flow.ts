import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { SECURE_HEADERS } from "../api-headers";
import { oauthCallbackForTokenExchange } from "./oauth-callback";

export const OAUTH_COOKIE = "qb_oauth_binding";
const cookiePath = "/api/quickbooks/callback";
const noncePattern = /^[a-f0-9]{64}$/;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export interface OAuthStateStore {
  issue(state: string, binding: string, context: string): Promise<void>;
  consume(state: string, binding: string, context: string): Promise<boolean>;
}
interface FlowConfig { clientId: string; redirectUri: string; environment: string }
interface FlowDependencies {
  config(): FlowConfig;
  store(): OAuthStateStore;
  adminPassword(): string | undefined;
  authorize(state: string): string;
  exchangeAndSave(callback: string): Promise<void>;
}

function configuration(request: NextRequest, config: FlowConfig) {
  const redirect = new URL(config.redirectUri);
  if (!config.clientId || !["sandbox", "production"].includes(config.environment)
    || redirect.pathname !== cookiePath || redirect.search || redirect.hash || redirect.username || redirect.password
    || redirect.origin !== request.nextUrl.origin
    || (redirect.protocol !== "https:" && !(redirect.protocol === "http:" && ["localhost", "127.0.0.1"].includes(redirect.hostname)))) {
    throw new Error("Invalid OAuth configuration.");
  }
  return { secure: redirect.protocol === "https:",
    context: hash(JSON.stringify([config.clientId, config.redirectUri, config.environment])) };
}
function headers(response: NextResponse) {
  Object.entries(SECURE_HEADERS).forEach(([key, value]) => response.headers.set(key, value));
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export function membershipOAuthFlow(deps: FlowDependencies) {
  return {
    async start(request: NextRequest) {
      const keys = request.nextUrl.searchParams.getAll("key");
      const password = deps.adminPassword();
      // Preserve the current initiation interface; missing configuration fails closed.
      if (!password || keys.length !== 1 || !keys[0] || !timingSafeEqual(Buffer.from(hash(keys[0])), Buffer.from(hash(password)))) {
        return headers(new NextResponse("Unauthorized", { status: 401 }));
      }
      try {
        const config = configuration(request, deps.config());
        const state = randomBytes(32).toString("hex");
        const binding = randomBytes(32).toString("hex");
        const destination = deps.authorize(state);
        await deps.store().issue(hash(state), hash(binding), config.context);
        const response = headers(NextResponse.redirect(destination, 302));
        response.cookies.set(OAUTH_COOKIE, binding, { httpOnly: true, sameSite: "lax", secure: config.secure,
          path: cookiePath, maxAge: 600 });
        return response;
      } catch {
        return headers(new NextResponse("QuickBooks connection is unavailable. Please try again later.", { status: 503 }));
      }
    },
    async callback(request: NextRequest) {
      let result = "error";
      try {
        const config = configuration(request, deps.config());
        const params = request.nextUrl.searchParams;
        const states = params.getAll("state");
        const bindings = request.cookies.getAll(OAUTH_COOKIE);
        if (states.length !== 1 || !noncePattern.test(states[0]) || bindings.length !== 1 || !noncePattern.test(bindings[0].value)) {
          throw new Error("Invalid OAuth state.");
        }
        if (!await deps.store().consume(hash(states[0]), hash(bindings[0].value), config.context)) {
          throw new Error("Expired or consumed OAuth state.");
        }
        // Consume even declines/malformed callbacks; failures require a fresh start.
        if (params.has("error") || !params.get("code") || !params.get("realmId")) {
          result = "declined";
        } else {
          await deps.exchangeAndSave(oauthCallbackForTokenExchange(request.url));
          result = "connected";
        }
      } catch {
        // Provider errors can include secrets. Do not log callback codes or tokens.
      }
      const response = headers(NextResponse.redirect(new URL(`/?qb=${result}`, request.url), 302));
      response.cookies.set(OAUTH_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:",
        path: cookiePath, maxAge: 0 });
      return response;
    },
  };
}
