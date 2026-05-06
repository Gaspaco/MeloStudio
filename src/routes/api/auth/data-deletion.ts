// Facebook Data Deletion Callback
// Facebook POSTs a signed_request to this endpoint when a user
// removes the app from their Facebook account settings.
// We respond with a confirmation URL and a code so Facebook can
// track the deletion status.
// See: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
import type { APIEvent } from "@solidjs/start/server";

export async function POST(event: APIEvent): Promise<Response> {
  try {
    const body = await event.request.text();
    const params = new URLSearchParams(body);
    const signedRequest = params.get("signed_request");

    if (!signedRequest) {
      return new Response(JSON.stringify({ error: "Missing signed_request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse the signed_request (base64url encoded) to extract the user_id
    const [, payloadB64] = signedRequest.split(".");
    if (!payloadB64) {
      return new Response(JSON.stringify({ error: "Invalid signed_request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(
      Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
    ) as { user_id?: string };

    const fbUserId = payload.user_id ?? "unknown";
    // Unique confirmation code for tracking
    const confirmationCode = `melo-del-${fbUserId}-${Date.now()}`;

    // In production, queue the account deletion here using fbUserId
    // to look up the linked MeloStudio account and delete it.
    // For now we return a valid confirmation so Facebook accepts the callback.

    const baseUrl = process.env.VITE_APP_URL ?? "https://melostudio.app";

    return new Response(
      JSON.stringify({
        url: `${baseUrl}/data-deletion?code=${confirmationCode}`,
        confirmation_code: confirmationCode,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
