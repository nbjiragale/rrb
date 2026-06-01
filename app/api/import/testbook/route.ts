import { NextResponse } from "next/server";
import { z } from "zod";
import { importTestbookMock } from "@/lib/services/testbookImport";

export const dynamic = "force-dynamic";

// HTTP entry point for the Testbook capture extension (server actions can't be
// called cross-origin from an extension, so the browser-side capture POSTs here).
// Same import path as the paste UI — just fed the raw payload automatically.
//
// Auth: when TESTBOOK_IMPORT_TOKEN is set, a matching Bearer token is required;
// unset means open (single-user localhost convenience, Hard Rule §5). The route
// is permissive on CORS because the caller is the user's own extension on their
// own machine, and the token (when set) is the real gate.

const bodySchema = z
  .object({
    payload: z.unknown().optional(),
    rawJson: z.string().optional(),
    externalTestId: z.string().trim().nullish(),
  })
  .refine((b) => b.payload !== undefined || (b.rawJson && b.rawJson.length > 0), {
    message: "Provide `payload` (parsed JSON) or `rawJson` (string).",
  });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
} as const;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const token = process.env.TESTBOOK_IMPORT_TOKEN;
  if (token && req.headers.get("authorization") !== `Bearer ${token}`) {
    return json({ error: "unauthorized" }, 401);
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request body.";
    return json({ error: message }, 400);
  }

  let raw: unknown = parsed.payload;
  if (raw === undefined) {
    try {
      raw = JSON.parse(parsed.rawJson!);
    } catch {
      return json({ error: "rawJson is not valid JSON." }, 400);
    }
  }

  try {
    const result = await importTestbookMock(raw, {
      externalTestId: parsed.externalTestId ?? null,
    });
    return json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed.";
    return json({ error: message }, 500);
  }
}
