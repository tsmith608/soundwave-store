import crypto from "crypto";

export interface SvixHeadersInput {
  id?: string | null;
  timestamp?: string | null;
  signature?: string | null;
  "svix-id"?: string | null;
  "svix-timestamp"?: string | null;
  "svix-signature"?: string | null;
  [key: string]: any;
}

export type SvixHeaders = SvixHeadersInput | Headers;

export interface SvixVerificationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Extracts Svix header values from either a Headers object or a plain object.
 */
function extractHeader(headers: SvixHeaders, key: string, aliasKey: string): string | null {
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(key) || (headers as Headers).get(aliasKey) || null;
  }
  const obj = headers as SvixHeadersInput;
  return obj[key] ?? obj[aliasKey] ?? null;
}

/**
 * Verifies a Svix webhook signature according to the Svix HMAC-SHA256 specification:
 * 1. Requires `svix-id`, `svix-timestamp`, and `svix-signature` headers.
 * 2. Enforces timestamp tolerance (|now - timestamp| <= 300 seconds) to prevent replay attacks.
 * 3. Strips `whsec_` prefix and decodes secret bytes from base64.
 * 4. Signs `${svix_id}.${svix_timestamp}.${rawBody}` with HMAC-SHA256.
 * 5. Uses `crypto.timingSafeEqual` against `v1,` signatures in `svix-signature`.
 */
export function verifySvixSignature(
  rawBody: string,
  headers: SvixHeaders,
  secret: string
): SvixVerificationResult {
  if (!secret) {
    return { valid: false, reason: "Missing webhook secret" };
  }

  const id = extractHeader(headers, "svix-id", "id");
  const timestamp = extractHeader(headers, "svix-timestamp", "timestamp");
  const signature = extractHeader(headers, "svix-signature", "signature");

  if (!id || !timestamp || !signature || !signature.trim()) {
    return { valid: false, reason: "Missing required svix headers" };
  }

  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) {
    return { valid: false, reason: "Invalid svix-timestamp header" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) {
    return { valid: false, reason: "Signature timestamp expired (>300s)" };
  }

  try {
    const cleanSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
    let secretBytes = Buffer.from(cleanSecret, "base64");
    if (secretBytes.length === 0) {
      secretBytes = Buffer.from(cleanSecret, "utf8");
    }

    const signedPayload = `${id}.${timestamp}.${rawBody}`;
    const computedHmac = crypto
      .createHmac("sha256", secretBytes)
      .update(signedPayload, "utf8")
      .digest("base64");

    const passedSigs = signature.trim().split(/\s+/);
    let matched = false;

    for (const item of passedSigs) {
      const commaIdx = item.indexOf(",");
      if (commaIdx === -1) continue;
      const version = item.slice(0, commaIdx);
      const sig = item.slice(commaIdx + 1);

      if (version === "v1" && sig) {
        const computedBuf = Buffer.from(computedHmac, "utf8");
        const sigBuf = Buffer.from(sig, "utf8");
        if (computedBuf.length === sigBuf.length && crypto.timingSafeEqual(computedBuf, sigBuf)) {
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      return { valid: false, reason: "Invalid HMAC signature" };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, reason: `Verification exception: ${err.message}` };
  }
}

/**
 * Helper to generate a valid Svix signature for testing and webhook dispatch.
 */
export function createSvixSignature(
  rawBody: string,
  secret: string,
  options?: { id?: string; timestamp?: number }
): { id: string; timestamp: string; signature: string; headers: Record<string, string> } {
  const cleanSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let secretBytes = Buffer.from(cleanSecret, "base64");
  if (secretBytes.length === 0) {
    secretBytes = Buffer.from(cleanSecret, "utf8");
  }

  const id = options?.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const timestamp = options?.timestamp ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${id}.${timestamp}.${rawBody}`;
  const hmac = crypto
    .createHmac("sha256", secretBytes)
    .update(signedPayload, "utf8")
    .digest("base64");

  const sigString = `v1,${hmac}`;

  return {
    id,
    timestamp: timestamp.toString(),
    signature: sigString,
    headers: {
      "svix-id": id,
      "svix-timestamp": timestamp.toString(),
      "svix-signature": sigString,
    },
  };
}
