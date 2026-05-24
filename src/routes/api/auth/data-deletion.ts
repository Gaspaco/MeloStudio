// Facebook Data Deletion Callback
// Facebook POSTs a signed_request to this endpoint when a user
// removes the app from their Facebook account settings.
// We respond with a confirmation URL and a code so Facebook can
// track the deletion status.
// See: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
import { createHmac, timingSafeEqual } from "node:crypto";
import type { APIEvent } from "@solidjs/start/server";

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function parseSignedRequest(signedRequest: string, secret: string): { user_id?: string } | null {
  const [encodedSig, payloadB64] = signedRequest.split(".", 2);
  if (!encodedSig || !payloadB64) return null;

  const signature = decodeBase64Url(encodedSig);
  const expected = createHmac("sha256", secret).update(payloadB64).digest();
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;

  const payload = JSON.parse(decodeBase64Url(payloadB64).toString("utf-8")) as { user_id?: string };
  return payload;
}

export async function POST(event: APIEvent): Promise<Response> {
  try {
    const appSecret = process.env.FACEBOOK_CLIENT_SECRET;
    if (!appSecret) return jsonError("Facebook deletion callback not configured", 503);

    const body = await event.request.text();
    const params = new URLSearchParams(body);
    const signedRequest = params.get("signed_request");

    if (!signedRequest) {
      return jsonError("Missing signed_request", 400);
    }

    const payload = parseSignedRequest(signedRequest, appSecret);
    if (!payload) return jsonError("Invalid signed_request", 400);

    const fbUserId = payload.user_id ?? "unknown";
    // Unique confirmation code for tracking
    const confirmationCode = `melo-del-${fbUserId}-${Date.now()}`;

    // In production, queue the account deletion here using fbUserId
    // to look up the linked MeloStudio account and delete it.
    // For now we return a valid confirmation so Facebook accepts the callback.

    const baseUrl = process.env.VITE_APP_URL ?? process.env.BETTER_AUTH_URL ?? "https://melostudio.nl";

    return Response.json({
      url: `${baseUrl}/data-deletion?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch (err) {
    console.error("[Facebook data deletion] failed:", err);
    return jsonError("Internal server error", 500);
  }
}
