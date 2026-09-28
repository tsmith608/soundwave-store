"use client";

import { useCallback, useRef, useState } from "react";
import { decodePeaksFromBlob } from "@/lib/art";
import { blobToWav } from "@/lib/art/peaks";

/**
 * Turns a customer's audio or video file into waveform peaks (in the browser)
 * and uploads only the sound. See docs/video-upload-support.md.
 */

export const MAX_DURATION_S = 15 * 60;
export const MAX_FILE_BYTES = 400 * 1024 * 1024;
const SERVER_AUDIO_LIMIT = 45 * 1024 * 1024; // server accepts 50 MB; keep headroom
const DIRECT_EXT = /\.(mp3|wav|webm|m4a)$/i;
const AUDIO_EXT = /\.(mp3|wav|webm|m4a|aac|ogg|oga|flac)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|3gp)$/i;

export type UploadState =
  | { phase: "idle" }
  | { phase: "reading" | "extracting" | "uploading"; name: string }
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

export function useMemoryUpload(onReady: (r: { peaks: number[]; audioId: string; info: MemoryInfo }) => void) {
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [info, setInfo] = useState<MemoryInfo | null>(null);
  const pending = useRef<{ blob: Blob; name: string; source: MemoryInfo["source"]; peaks: number[]; duration: number } | null>(null);

  const upload = useCallback(
    async (blob: Blob, name: string, source: MemoryInfo["source"], peaks: number[], duration: number) => {
      setState({ phase: "uploading", name });
      try {
        const direct = source !== "video" && blob.size <= SERVER_AUDIO_LIMIT && (DIRECT_EXT.test(name) || /webm|wav|mpeg/.test(blob.type));
        // Videos and unusual/large audio are re-encoded to a compact WAV in the browser:
        // only the sound is sent, the footage never leaves the device.
        const file = direct ? new File([blob], name, { type: blob.type || "audio/webm" }) : new File([await blobToWav(blob)], "memory.wav", { type: "audio/wav" });
        const form = new FormData();
        form.append("audio", file);
        let res: Response;
        try {
          res = await fetch("/api/upload", { method: "POST", body: form });
        } catch {
          setState({ phase: "error", name, code: "network", message: "The upload didn’t go through — check your connection and try again." });
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.audioId) {
          setState({ phase: "error", name, code: "server", message: data.error || "We couldn’t save that recording. Please try again." });
          return;
        }
        const i: MemoryInfo = { source, fileName: name, duration };
        setInfo(i);
        pending.current = null;
        setState({ phase: "ready", name });
        onReady({ peaks, audioId: data.audioId, info: i });
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
        setState({ phase: "error", name, code: "too_long", message: `That recording is ${Math.round(probed / 60)} minutes long. Please trim it to under 15 minutes — the moment you want is plenty.` });
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
        setState({ phase: "error", name, code: "too_long", message: "That recording is longer than 15 minutes. Please trim it to the moment you want." });
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

  return { state, info, handle, retry, reset, canRetry: () => pending.current !== null };
}
