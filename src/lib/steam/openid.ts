/**
 * Steam sign-in.
 *
 * Steam uses OpenID 2.0 — not OpenID Connect — so none of the usual OIDC
 * libraries apply. The flow is small enough to implement directly:
 *
 *   1. Send the user to Steam with `checkid_setup`.
 *   2. Steam sends them back with a pile of `openid.*` query params.
 *   3. We POST those params back to Steam with mode `check_authentication`.
 *
 * Step 3 is not optional. The callback is just a URL, so without asking
 * Steam to confirm it signed those params, anyone could log in as anyone
 * by typing a claimed_id into the address bar.
 */

const STEAM_OPENID = "https://steamcommunity.com/openid/login";
const NS = "http://specs.openid.net/auth/2.0";
const IDENTIFIER_SELECT = "http://specs.openid.net/auth/2.0/identifier_select";

/** SteamID64 sits at the end of the claimed identity URL. */
const CLAIMED_ID_RE =
  /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

export function buildLoginUrl(appUrl: string): string {
  const url = new URL(STEAM_OPENID);
  url.searchParams.set("openid.ns", NS);
  url.searchParams.set("openid.mode", "checkid_setup");
  url.searchParams.set("openid.return_to", `${appUrl}/api/auth/steam/return`);
  url.searchParams.set("openid.realm", appUrl);
  url.searchParams.set("openid.identity", IDENTIFIER_SELECT);
  url.searchParams.set("openid.claimed_id", IDENTIFIER_SELECT);
  return url.toString();
}

/**
 * Verifies the callback with Steam and returns the SteamID64, or null if
 * the assertion is not genuine.
 */
export async function verifyCallback(
  params: URLSearchParams,
): Promise<string | null> {
  const claimedId = params.get("openid.claimed_id");
  if (!claimedId) return null;

  const match = CLAIMED_ID_RE.exec(claimedId);
  if (!match) return null;
  const steamId = match[1];

  // Echo every openid.* param back, swapping the mode. Signed fields must
  // be returned byte-for-byte or Steam rejects the check.
  const body = new URLSearchParams();
  for (const [key, value] of params) {
    if (key.startsWith("openid.")) body.set(key, value);
  }
  body.set("openid.mode", "check_authentication");

  const res = await fetch(STEAM_OPENID, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) return null;

  // Response is key:value lines, e.g. "ns:...\nis_valid:true\n"
  const text = await res.text();
  const isValid = text
    .split("\n")
    .some((line) => line.trim() === "is_valid:true");

  return isValid ? steamId : null;
}
