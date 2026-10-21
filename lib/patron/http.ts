import { createHmac } from "node:crypto";
import { checkPatronSchema, editPatronSchema, signupSchema, PATRON_PERIOD, type PatronStore } from "./model";
import { readLoginBody, LoginBodyTooLarge } from "../gala/backend/staff-login";
import { SECURE_HEADERS } from "../api-headers";

type Dependencies = {
  enabled: () => boolean;
  config: () => { origin: string; key: string; local: boolean };
  authorize: (request: Request) => void;
  store: () => Promise<PatronStore>;
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: SECURE_HEADERS });
function failure(error: unknown) {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (error instanceof LoginBodyTooLarge) return json({ error: "The form is too large." }, 413);
  if (error instanceof SyntaxError) return json({ error: "Please check the form and try again." }, 400);
  if (message.includes("patron_rate_limit")) return Response.json({ error: "Too many signups. Please try again in 15 minutes." },
    { status: 429, headers: { ...SECURE_HEADERS, "Retry-After": "900" } });
  if (message.includes("patron_request_conflict") || message.includes("patron_contact_period"))
    return json({ error: "This entry conflicts with an existing patron. Refresh the roster before trying again." }, 409);
  return json({ error: "We couldn’t save or load the patron information. Please try again." }, 503);
}

export function patronHandlers(deps: Dependencies) {
  function access(request: Request, admin: boolean) {
    if (!deps.enabled()) return json({ error: "Patron registration is not available yet." }, 404);
    if (admin) {
      try { deps.authorize(request); }
      catch { return json({ error: "Please sign in to administration again." }, 401); }
    }
    if (request.method !== "GET" && request.headers.get("origin") !== deps.config().origin)
      return json({ error: "Please submit this form from the Guild website." }, 403);
    return null;
  }
  return {
    async signup(request: Request) {
      try {
        const blocked = access(request, false); if (blocked) return blocked;
        const input = signupSchema.safeParse(await readLoginBody(request));
        if (!input.success) return json({ error: "Please check your name, email, phone, and name-display permission." }, 400);
        // A hidden website field catches basic form bots without publishing spam.
        if (input.data.company) return json({ ok: true });
        const config = deps.config();
        const address = config.local ? "local" : (request.headers.get("x-vercel-forwarded-for") || "unknown").split(",")[0].trim().slice(0, 128);
        const clientHash = createHmac("sha256", config.key).update(`patron:${address}`).digest("hex");
        const { name, email, phone, requestId } = input.data;
        await (await deps.store()).add({ name, email, phone, requestId, period: PATRON_PERIOD, source: "online", published: false, clientHash });
        return json({ ok: true });
      } catch (error) { return failure(error); }
    },
    async list(request: Request) {
      try {
        const blocked = access(request, true); if (blocked) return blocked;
        return json({ patrons: await (await deps.store()).list(PATRON_PERIOD) });
      } catch (error) { return failure(error); }
    },
    async add(request: Request) {
      try {
        const blocked = access(request, true); if (blocked) return blocked;
        const input = checkPatronSchema.safeParse(await readLoginBody(request));
        if (!input.success) return json({ error: "Please check the patron’s name and contact details." }, 400);
        await (await deps.store()).add({ ...input.data, period: PATRON_PERIOD, source: "check", clientHash: "" });
        return json({ ok: true });
      } catch (error) { return failure(error); }
    },
    async edit(request: Request) {
      try {
        const blocked = access(request, true); if (blocked) return blocked;
        const input = editPatronSchema.safeParse(await readLoginBody(request));
        if (!input.success) return json({ error: "Please check the patron’s name and contact details." }, 400);
        const found = await (await deps.store()).edit(input.data, PATRON_PERIOD);
        return found ? json({ ok: true }) : json({ error: "This patron could not be found. Refresh the roster." }, 404);
      } catch (error) { return failure(error); }
    },
  };
}
