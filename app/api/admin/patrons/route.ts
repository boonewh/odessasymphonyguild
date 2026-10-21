import { patronApi } from "@/lib/patron/server";
export const runtime = "nodejs";
export const GET = patronApi.list;
export const POST = patronApi.add;
export const PATCH = patronApi.edit;
