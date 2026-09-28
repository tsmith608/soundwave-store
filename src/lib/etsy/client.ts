/**
 * Etsy Open API v3 Client & OAuth 2.0 PKCE Helper Functions
 *
 * Implements RFC 7636 PKCE (Proof Key for Code Exchange) with S256 code challenge,
 * authorization URL construction, authorization code exchange, and token refresh
 * with token rotation support.
 */

import crypto from "crypto";
import { EtsyReceipt, EtsyReceiptsResponse, EtsyTokenResponse } from "./types";

const ETSY_OAUTH_CONNECT_URL = "https://www.etsy.com/oauth/connect";
const ETSY_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
const ETSY_API_BASE_URL = "https://api.etsy.com/v3/application";

/**
 * Returns true if Etsy API credentials (ETSY_KEYSTRING or ETSY_API_KEY) are set in environment.
 */
export function isEtsyConfigured(): boolean {
  const key = process.env.ETSY_KEYSTRING || process.env.ETSY_API_KEY;
  return Boolean(key && key.trim().length > 0);
}

/**
 * Returns the configured Etsy client ID (keystring) or null if unset.
 */
export function getEtsyClientId(): string | null {
  const key = process.env.ETSY_KEYSTRING || process.env.ETSY_API_KEY;
  return key && key.trim().length > 0 ? key.trim() : null;
}

/**
 * Generates an RFC 7636 compliant code verifier: 32 cryptographically secure
 * random bytes encoded in base64url (43 unreserved characters: [A-Za-z0-9_-]).
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Generates an RFC 7636 S256 code challenge: SHA-256 hash of the verifier
 * encoded in base64url.
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier, "utf8").digest("base64url");
}

/**
 * Generates a high-entropy state string (16 random bytes as hex) for CSRF mitigation.
 */
export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Constructs the full Etsy v3 OAuth 2.0 PKCE authorization URL.
 *
 * @param redirectUri Registered redirect callback URI
 * @param state CSRF defense state token
 * @param codeChallenge S256 code challenge derived from code verifier
 * @param scope OAuth scopes (defaults to "transactions_r shops_r")
 */
export function getAuthorizationUrl(
  redirectUri: string,
  state: string,
  codeChallenge: string,
  scope: string = "transactions_r shops_r"
): string {
  const clientId = getEtsyClientId();
  if (!clientId) {
    throw new Error("Etsy API keys not configured. Set ETSY_KEYSTRING or ETSY_API_KEY.");
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scope,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${ETSY_OAUTH_CONNECT_URL}?${params.toString()}`;
}

/**
 * Exchanges an authorization code and PKCE code verifier for Etsy v3 access & refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<EtsyTokenResponse> {
  const clientId = getEtsyClientId();
  if (!clientId) {
    throw new Error("Etsy API keys not configured. Set ETSY_KEYSTRING or ETSY_API_KEY.");
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code: code,
    code_verifier: codeVerifier,
  });

  const response = await fetch(ETSY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Etsy token exchange failed (HTTP ${response.status}): ${errorText}`
    );
  }

  return (await response.json()) as EtsyTokenResponse;
}

/**
 * Refreshes an expired Etsy v3 access token using the refresh token.
 * Note: Etsy rotates refresh tokens on every refresh call. The caller MUST persist
 * the newly returned refresh_token immediately.
 */
export async function refreshAccessToken(refreshToken: string): Promise<EtsyTokenResponse> {
  const clientId = getEtsyClientId();
  if (!clientId) {
    throw new Error("Etsy API keys not configured. Set ETSY_KEYSTRING or ETSY_API_KEY.");
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: refreshToken,
  });

  const response = await fetch(ETSY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Etsy token refresh failed (HTTP ${response.status}): ${errorText}`
    );
  }

  return (await response.json()) as EtsyTokenResponse;
}

/**
 * Fetches shop receipts from Etsy Open API v3 when configured.
 */
export async function fetchShopReceipts(
  shopId: string,
  accessToken: string,
  options?: {
    minCreated?: number;
    limit?: number;
    wasPaid?: boolean;
    wasShipped?: boolean;
  }
): Promise<EtsyReceipt[]> {
  const clientId = getEtsyClientId();
  if (!clientId) {
    throw new Error("Etsy API keys not configured. Set ETSY_KEYSTRING or ETSY_API_KEY.");
  }

  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.minCreated) params.set("min_created", String(options.minCreated));
  if (options?.wasPaid !== undefined) params.set("was_paid", String(options.wasPaid));
  if (options?.wasShipped !== undefined) params.set("was_shipped", String(options.wasShipped));

  const qs = params.toString();
  const url = `${ETSY_API_BASE_URL}/shops/${shopId}/receipts${qs ? `?${qs}` : ""}`;

  const response = await fetch(url, {
    headers: {
      "x-api-key": clientId,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch Etsy receipts (HTTP ${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as EtsyReceiptsResponse;
  return data.results || [];
}
