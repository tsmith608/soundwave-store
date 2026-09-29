/**
 * Origin the browser talks to for presigned uploads/downloads. Used by the
 * CSP (connect-src / media-src). Pure: no SDK imports (runs in proxy.ts).
 */
export function storageOrigin(env: Record<string, string | undefined> = process.env): string | null {
  if (env.STORAGE_PUBLIC_ORIGIN) return env.STORAGE_PUBLIC_ORIGIN.replace(/\/$/, "");
  if (env.STORAGE_DRIVER !== "s3" || !env.S3_BUCKET) return null;
  try {
    if (env.S3_ENDPOINT) {
      const u = new URL(env.S3_ENDPOINT);
      return env.S3_FORCE_PATH_STYLE === "true" ? u.origin : `${u.protocol}//${env.S3_BUCKET}.${u.host}`;
    }
    const region = env.S3_REGION && env.S3_REGION !== "auto" ? env.S3_REGION : "us-east-1";
    return `https://${env.S3_BUCKET}.s3.${region}.amazonaws.com`;
  } catch {
    return null;
  }
}
