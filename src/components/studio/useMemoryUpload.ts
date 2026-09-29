"use client";

import { useCallback, useRef, useState } from "react";
import { decodePeaksFromBlob } from "@/lib/art";
import { blobToWav } from "@/lib/art/peaks";

/**
 * Turns a customer's audio or video file into waveform peaks (in the browser)
 * and uploads only the sound. See docs/video-upload-support.md.
 */

export const MAX_DURATION_S = 3 * 60;
export const MAX_FILE_BYTES = 400 * 1024 * 1024;
// Anything bigger is re-encoded to mono 22 kHz WAV (~8 MB for 3 min) so stored
// recordings stay small — they are kept for as long as the QR code plays them.
const DIRECT_UPLOAD_LIMIT = 10 * 1024 * 1024;
const DIRECT_EXT = /\.(mp3|wav|webm|m4a)$/i;
const AUDIO_EXT = /\.(mp3|wav|webm|m4a|aac|ogg|oga|flac)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|3gp)$/i;

export type UploadState =
  | { phase: "idle" }
  | { phase: "reading" | "extracting" | "verifying"; name: string }
  | { phase: "uploading"; name: string; progress: number }
  | { phase: "ready"; name: string }
  | { phase: "error"; name?: string; code: ErrorCode; message: string };

export type ErrorCode = "unsupported" | "too_large" | "too_long" | "no_audio" | "unreadable" | "network" | "server";

export interface MemoryInfo {
  source: "video" | "audio" | "recording";
  fileName: string;
  duration: number; // seconds
}

export const ACCEPT = "audio/*,video/*,.mp3,.wav,.m4a,.aac,.webm,.mp4,.mov,.m4v";

export function formatLength(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${String(m).padStart(2, "0")}:${sec.toFixed(2).padStart(5, "0")}`;
}

/** Reads duration from metadata without decoding the whole file. Resolves NaN if unknown. */
function probeDuration(blob: Blob, video: boolean): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const el = document.createElement(video ? "video" : "audio");
    const done = (v: number) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    const t = setTimeout(() => done(NaN), 8000);
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      clearTimeout(t);
      done(Number.isFinite(el.duration) ? el.duration : NaN);
    };
    el.onerror = () => {
      clearTimeout(t);
      done(NaN);
    };
    el.src = url;
  });
}

/** PUT with upload progress (fetch can't report upload progress). */
function putWithProgress(url: string, headers: Record<string, string>, body: Blob, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`storage ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("network"));
    xhr.timeout = 180_000;
    xhr.send(body);
  });
}

export interface ReadyResult {
  peaks: number[];
  assetId: string;
  info: MemoryInfo;
}

export function useMemoryUpload(onReady: (r: ReadyResult) => void) {
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [info, setInfo] = useState<MemoryInfo | null>(null);
  const pending = useRef<{ blob: Blob; name: string; source: MemoryInfo["source"]; peaks: number[]; duration: number } | null>(null);

  const upload = useCallback(
    async (blob: Blob, name: string, source: MemoryInfo["source"], peaks: number[], duration: number) => {
      setState({ phase: "uploading", name, progress: 0 });
      try {
        const direct = source !== "video" && blob.size <= DIRECT_UPLOAD_LIMIT && (DIRECT_EXT.test(name) || /webm|wav|mpeg|mp4|m4a/.test(blob.type)) && /^audio\//.test(blob.type || "audio/");
        // Videos and unusual/large audio are re-encoded to a compact WAV in the browser:
        // only the sound is sent, the footage never leaves the device.
        const file: Blob = direct ? blob : await blobToWav(blob);
        const mimeType = direct ? (blob.type || "audio/webm").split(";")[0] : "audio/wav";
        let intent: { assetId: string; upload: { url: string; headers: Record<string, string> } };
        try {
          const r = await fetch("/api/uploads", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ fileName: name, mimeType, sizeBytes: file.size, durationMs: Math.round(duration * 1000), source }),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            setState({ phase: "error", name, code: r.status === 413 ? "too_large" : r.status === 415 ? "unsupported" : "server", message: data.error || "We couldn’t save that recording. Please try again." });
            return;
          }
          intent = data;
        } catch {
          setState({ phase: "error", name, code: "network", message: "The upload didn’t go through — check your connection and try again." });
          return;
        }
        try {
          await putWithProgress(intent.upload.url, intent.upload.headers, file, (p) => setState({ phase: "uploading", name, progress: p }));
        } catch {
          setState({ phase: "error", name, code: "network", message: "The upload was interrupted — check your connection and try again." });
          return;
        }
        setState({ phase: "verifying", name });
        const done = await fetch(`/api/uploads/${intent.assetId}/complete`, { method: "POST" }).catch(() => null);
        const dj = done ? await done.json().catch(() => ({})) : {};
        if (!done || !done.ok) {
          setState({ phase: "error", name, code: done ? "server" : "network", message: dj.error || "We couldn’t verify that upload. Please try again." });
          return;
        }
        const i: MemoryInfo = { source, fileName: name, duration };
        setInfo(i);
        pending.current = null;
        setState({ phase: "ready", name });
        onReady({ peaks, assetId: intent.assetId, info: i });
      } catch {
        setState({ phase: "error", name, code: "unreadable", message: "Something went wrong preparing your recording. Please try again." });
      }
    },
    [onReady]
  );
  const handle = useCallback(
    async (blob: Blob, name: string, forced?: MemoryInfo["source"]) => {
      const isVideo = forced ? forced === "video" : blob.type.startsWith("video/") || (VIDEO_EXT.test(name) && !/\.webm$/i.test(name));
      const isAudio = forced === "recording" || blob.type.startsWith("audio/") || AUDIO_EXT.test(name);
      const source: MemoryInfo["source"] = forced ?? (isVideo ? "video" : "audio");
      if (!isVideo && !isAudio && !VIDEO_EXT.test(name)) {
        setState({ phase: "error", name, code: "unsupported", message: "That file type isn’t supported. Upload a video (MP4, MOV, M4V) or audio (M4A, MP3, WAV, AAC)." });
        return;
      }
      if (blob.size > MAX_FILE_BYTES) {
        setState({ phase: "error", name, code: "too_large", message: "That file is over 400 MB. Trim it to the moment you want and try again." });
        return;
      }
      setState({ phase: "reading", name });
      const probed = await probeDuration(blob, isVideo);
      if (probed > MAX_DURATION_S) {
        setState({ phase: "error", name, code: "too_long", message: `That recording is ${formatLength(probed)} long. Please trim it to under 3 minutes — the moment you want is plenty.` });
        return;
      }
      setState({ phase: "extracting", name });
      let decoded: { peaks: number[]; duration: number; level: number };
      try {
        decoded = await decodePeaksFromBlob(blob);
      } catch {
        setState({
          phase: "error",
          name,
          code: isVideo ? "no_audio" : "unreadable",
          message: isVideo
            ? "We couldn’t find a soundtrack we can read in this video. It may have no audio, or use a format your browser can’t open — try saving it again from your camera roll, or upload an audio file."
            : "This file looks damaged or uses a format your browser can’t read. Try an M4A, MP3 or WAV.",
        });
        return;
      }
      if (decoded.duration > MAX_DURATION_S) {
        setState({ phase: "error", name, code: "too_long", message: "That recording is longer than 3 minutes. Please trim it to the moment you want." });
        return;
      }
      if (decoded.duration < 0.5) {
        setState({ phase: "error", name, code: "unreadable", message: "That recording is too short — try at least a second or two." });
        return;
      }
      if (decoded.level < 0.002) {
        setState({ phase: "error", name, code: "no_audio", message: "This file seems to be silent. Does the video have sound? Try another clip." });
        return;
      }
      pending.current = { blob, name, source, peaks: decoded.peaks, duration: decoded.duration };
      await upload(blob, name, source, decoded.peaks, decoded.duration);
    },
    [upload]
  );

  const retry = useCallback(() => {
    const p = pending.current;
    if (p) void upload(p.blob, p.name, p.source, p.peaks, p.duration);
  }, [upload]);

  const reset = useCallback(() => {
    pending.current = null;
    setInfo(null);
    setState({ phase: "idle" });
  }, []);

  /** Restores a previously uploaded recording (after refresh or when editing a cart item). */
  const restore = useCallback((i: MemoryInfo) => {
    setInfo(i);
    setState({ phase: "ready", name: i.fileName });
  }, []);

  return { state, info, handle, retry, reset, restore, canRetry: () => pending.current !== null };
}
