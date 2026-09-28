/**
 * Optional "listen link": a public URL the customer supplies (Spotify, Apple
 * Music, YouTube, a shared album…). It is ONLY a QR destination.
 *
 * Hard rule: this value is never fetched, downloaded or analysed. Artwork is
 * generated exclusively from the recording the customer uploads.
 */
export function cleanListenUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;
  if (raw.length > 500) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!url.hostname.includes(".") || url.username || url.password) return null;
  return url.toString();
}

/** Friendly service name for UI copy ("Opens on Spotify"). */
export function listenServiceName(url: string): string {
  const h = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  if (/spotify\.com$/.test(h)) return "Spotify";
  if (/music\.apple\.com$/.test(h)) return "Apple Music";
  if (/(youtube\.com|youtu\.be)$/.test(h)) return "YouTube";
  if (/soundcloud\.com$/.test(h)) return "SoundCloud";
  if (/tidal\.com$/.test(h)) return "Tidal";
  return h || "your link";
}
