"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Artwork from "@/components/art/Artwork";
import FramedArtwork from "@/components/art/FramedArtwork";
import Meta from "@/components/brand/Meta";
import { WaveBars } from "@/components/brand/shapes";
import { DESIGNS, EMPTY_FIELDS, getSellableDesign, type ArtFields, type FieldKey } from "@/lib/art";
import { DEFAULT_SIZE_ID, FORMATS, FRAME_FINISHES, OCCASIONS, formatPrice, getPrintSize, type ProductFormat } from "@/lib/catalog";
import { cleanListenUrl, listenServiceName } from "@/lib/listenLink";
import { track } from "@/lib/analytics";
import { ACCEPT, formatLength, useMemoryUpload, type MemoryInfo, type ReadyResult } from "./useMemoryUpload";

export interface StudioVariant {
  id: string;
  format: ProductFormat;
  sizeId: string;
  label: string;
  widthIn: number;
  heightIn: number;
  priceCents: number;
  frameFinishes: string[];
  leadTimeMinDays: number;
  leadTimeMaxDays: number;
}

export interface StudioProps {
  variants: StudioVariant[];
  initialDesign?: string;
  initialOccasion?: string;
  initialColorway?: string;
  initialSize?: string;
  /** Open an existing saved project (edit from cart / account). */
  projectId?: string;
  /** Cart line being edited: saving updates it instead of adding a new one. */
  editItem?: { id: string; variantId: string; frameFinish: string | null; quantity: number } | null;
}

// Old ?template= links and retired design ids land on the nearest current design.
const LEGACY_TEMPLATE_MAP: Record<string, string> = {
  botanical: "herbarium",
  celestial: "night-of",
  arch: "night-of",
  minimal: "herbarium",
  modern_border: "night-of",
  art_deco: "night-of",
  luxury_marble: "night-of",
  vintage_grunge: "herbarium",
  abstract_geometric: "night-of",
  "liner-notes": "night-of",
  "in-memoriam": "herbarium",
};

const STEPS = ["Memory", "Artwork", "Details", "Print", "Review"] as const;
type QrChoice = "discreet" | "standard" | "off";
const DRAFT_KEY = "sw_studio_draft_v2";

/** What undo restores and what autosave persists. */
interface Snapshot {
  designId: string;
  colorwayId: string;
  fields: ArtFields;
  touched: boolean;
  qr: QrChoice;
  qrTarget: "recording" | "link";
  listenUrl: string;
}

interface Draft extends Snapshot {
  v: 2;
  savedAt: number;
  occasionId?: string;
  sizeId: string;
  format: ProductFormat;
  frameFinish: string;
  quantity: number;
  rights: boolean;
  projectId: string | null;
  asset: { id: string; peaks: number[]; info: MemoryInfo } | null;
}

function readDraft(): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") as Draft | null;
    if (!d || d.v !== 2 || Date.now() - d.savedAt > 30 * 86400_000) return null;
    return d;
  } catch {
    return null;
  }
}
function Recorder({ onDone }: { onDone: (b: Blob) => void }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const start = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timer.current) clearInterval(timer.current);
        onDone(new Blob(chunks, { type: mr.mimeType || "audio/webm" }));
        setRec(null);
      };
      mr.start();
      setSecs(0);
      timer.current = setInterval(() => setSecs((s) => s + 1), 1000);
      setRec(mr);
    } catch {
      setErr("We couldn’t use your microphone. Check your browser’s permission, or upload a file instead.");
    }
  };
  return (
    <div>
      {rec ? (
        <button type="button" onClick={() => rec.stop()} className="btn btn-ink w-full justify-between">
          <span className="flex items-center gap-2">
            <span className="anim-blink h-2.5 w-2.5 rounded-full bg-signal" /> Stop recording · {secs}s
          </span>
          <span className="btn-arrow" aria-hidden>
            ■
          </span>
        </button>
      ) : (
        <button type="button" onClick={start} className="btn w-full justify-between">
          <span>Record a voice note now</span>
          <span className="btn-arrow" aria-hidden>
            ●
          </span>
        </button>
      )}
      {err && <p className="mt-2 text-sm text-[#B2361B]">{err}</p>}
    </div>
  );
}

export default function Studio({ variants, initialDesign, initialOccasion, initialColorway, initialSize, projectId: initialProjectId, editItem }: StudioProps) {
  const occasion0 = OCCASIONS.find((o) => o.id === initialOccasion);
  const design0 = getSellableDesign(initialDesign) ?? getSellableDesign(LEGACY_TEMPLATE_MAP[initialDesign ?? ""]) ?? getSellableDesign(occasion0?.designId) ?? DESIGNS[0];
  const editVariant = editItem ? variants.find((v) => v.id === editItem.variantId) : undefined;

  const [step, setStep] = useState(0);
  const [occasionId, setOccasionId] = useState<string | undefined>(occasion0?.id);
  const [designId, setDesignId] = useState(design0.id);
  const [designChosen, setDesignChosen] = useState(Boolean(initialDesign));
  const design = getSellableDesign(designId) ?? DESIGNS[0];
  const [colorwayId, setColorwayId] = useState(
    design0.colorways.find((c) => c.id === initialColorway)?.id ?? (occasion0?.designId === design0.id ? occasion0?.colorwayId : undefined) ?? design0.colorways[0].id
  );
  const [fields, setFields] = useState<ArtFields>({ ...EMPTY_FIELDS });
  const [touched, setTouched] = useState(false);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [rights, setRights] = useState(false);
  const [qr, setQr] = useState<QrChoice>("discreet");
  const [qrTarget, setQrTarget] = useState<"recording" | "link">("recording");
  const [listenUrl, setListenUrl] = useState("");
  const [sizeId, setSizeId] = useState(editVariant?.sizeId ?? getPrintSize(initialSize)?.id ?? DEFAULT_SIZE_ID);
  const [format, setFormat] = useState<ProductFormat>(editVariant?.format ?? "framed");
  const [frameFinish, setFrameFinish] = useState(editItem?.frameFinish ?? "black");
  const [quantity, setQuantity] = useState(editItem?.quantity ?? 1);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId ?? null);
  const [busy, setBusy] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [restored, setRestored] = useState(false);
  const [loaded, setLoaded] = useState(!initialProjectId);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "offline">("idle");
  const [history, setHistory] = useState<Snapshot[]>([]);
  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastSnap = useRef<Snapshot | null>(null);

  const variant = variants.find((v) => v.format === format && v.sizeId === sizeId) ?? variants.find((v) => v.format === format) ?? variants[0];
  const size = getPrintSize(variant?.sizeId) ?? getPrintSize(DEFAULT_SIZE_ID)!;
  const unitPrice = variant?.priceCents ?? size.price[format];
  const price = unitPrice * quantity;
  const sizesForFormat = variants.filter((v) => v.format === format);
  const finishes = variant?.frameFinishes.length ? FRAME_FINISHES.filter((f) => variant.frameFinishes.includes(f.id)) : [];
  const occasion = OCCASIONS.find((o) => o.id === occasionId);
  const showQr = qr !== "off";
  const artQrStyle = qr === "standard" ? "standard" : "discreet";
  const cleanedUrl = qrTarget === "link" ? cleanListenUrl(listenUrl) : null;
  const urlInvalid = qrTarget === "link" && listenUrl.trim() !== "" && !cleanedUrl;
  const snapshot: Snapshot = { designId, colorwayId, fields, touched, qr, qrTarget, listenUrl };

  const applySnapshot = (s: Snapshot) => {
    setDesignId(s.designId);
    setColorwayId(s.colorwayId);
    setFields(s.fields);
    setTouched(s.touched);
    setQr(s.qr);
    setQrTarget(s.qrTarget);
    setListenUrl(s.listenUrl);
  };

  const onReady = useCallback(
    ({ peaks: p, assetId: id, info }: ReadyResult) => {
      setPeaks(p);
      setAssetId(id);
      track("media_uploaded", { design_id: designId, occasion: occasionId, source_type: info.source, duration_s: Math.round(info.duration) });
    },
    [designId, occasionId]
  );
  const mem = useMemoryUpload(onReady);

  // ── Restore: an explicit project (edit) wins over the device draft ────────
  useEffect(() => {
    track("product_view", { design_id: design0.id, occasion: occasion0?.id }, { onceKey: "studio" });
    if (initialProjectId) {
      fetch(`/api/projects/${initialProjectId}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(({ project, audio }) => {
          const o = project.options ?? {};
          applySnapshot({
            designId: project.designId,
            colorwayId: project.colorwayId,
            fields: { ...EMPTY_FIELDS, ...project.fields },
            touched: true,
            qr: o.showQr === false ? "off" : o.qrStyle === "standard" ? "standard" : "discreet",
            qrTarget: o.qrTarget === "link" ? "link" : "recording",
            listenUrl: o.listenUrl ?? "",
          });
          setDesignChosen(true);
          setRights(Boolean(project.rightsConfirmed));
          if (project.peaks && audio) {
            setPeaks(project.peaks);
            setAssetId(audio.id);
            mem.restore({ source: audio.source, fileName: audio.fileName ?? "Your recording", duration: (audio.durationMs ?? 0) / 1000 });
          }
          if (project.status === "ordered") setProjectId(null); // editing a purchased design creates a copy
          setStep(editItem ? 3 : 2);
        })
        .catch(() => setOrderError("We couldn’t open that saved design. You can start a new one below."))
        .finally(() => setLoaded(true));
      return;
    }
    const d = readDraft();
    if (d) {
      // A refresh keeps the recording, words and choices. If the visitor arrived
      // via a link to a different design, switch to it but keep everything else.
      // Restoring a device draft must happen after mount (localStorage is browser-only).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      applySnapshot(d);
      const linked = getSellableDesign(initialDesign) ?? getSellableDesign(LEGACY_TEMPLATE_MAP[initialDesign ?? ""]);
      if (linked && linked.id !== d.designId) {
        setDesignId(linked.id);
        setColorwayId(linked.colorways.find((c) => c.id === initialColorway)?.id ?? linked.colorways[0].id);
      }
      setDesignChosen(true);
      setOccasionId(d.occasionId);
      setSizeId(d.sizeId);
      setFormat(d.format);
      setFrameFinish(d.frameFinish);
      setQuantity(d.quantity || 1);
      setRights(d.rights);
      setProjectId(d.projectId);
      if (d.asset) {
        setPeaks(d.asset.peaks);
        setAssetId(d.asset.id);
        mem.restore(d.asset.info);
      }
      setRestored(Boolean(d.touched || d.asset));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Autosave to this device (survives refresh) ───────────────────────────
  useEffect(() => {
    if (!loaded || editItem) return;
    const t = setTimeout(() => {
      try {
        const d: Draft = { v: 2, savedAt: Date.now(), ...snapshot, occasionId, sizeId, format, frameFinish, quantity, rights, projectId, asset: assetId && peaks && mem.info ? { id: assetId, peaks, info: mem.info } : null };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
      } catch {}
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, designId, colorwayId, fields, touched, qr, qrTarget, listenUrl, occasionId, sizeId, format, frameFinish, quantity, rights, projectId, assetId, peaks, mem.info]);

  // ── Undo history (text edits are grouped by a short pause) ────────────────
  useEffect(() => {
    const prev = lastSnap.current;
    const t = setTimeout(() => {
      if (prev && JSON.stringify(prev) !== JSON.stringify(snapshot)) setHistory((h) => [...h.slice(-49), prev]);
      lastSnap.current = snapshot;
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designId, colorwayId, fields, qr, qrTarget, listenUrl]);

  const undo = () => {
    setHistory((h) => {
      const prev = h[h.length - 1];
      if (!prev) return h;
      lastSnap.current = prev;
      applySnapshot(prev);
      return h.slice(0, -1);
    });
  };

  const reset = () => {
    if (!window.confirm("Start over? This clears your words, design choices and recording from this device.")) return;
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    applySnapshot({ designId: design0.id, colorwayId: design0.colorways[0].id, fields: { ...EMPTY_FIELDS }, touched: false, qr: "discreet", qrTarget: "recording", listenUrl: "" });
    setPeaks(null);
    setAssetId(null);
    setRights(false);
    setProjectId(null);
    setQuantity(1);
    setHistory([]);
    setRestored(false);
    mem.reset();
    setStep(0);
  };

  const projectBody = () => ({
    designId,
    colorwayId,
    fields,
    options: { showQr, qrStyle: artQrStyle, qrTarget: showQr ? qrTarget : "recording", listenUrl: showQr && qrTarget === "link" ? cleanedUrl : null },
    peaks,
    audioAssetId: assetId,
    rightsConfirmed: rights,
  });

  /** Saves the design on the server (needed for the cart). Returns the project id. */
  const saveProject = useCallback(async (): Promise<string> => {
    setSaveState("saving");
    try {
      const res = await fetch(projectId ? `/api/projects/${projectId}` : "/api/projects", {
        method: projectId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(projectBody()),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 404 && projectId) {
        // Saved on another device or deleted: start a fresh project.
        setProjectId(null);
        const r2 = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(projectBody()) });
        const d2 = await r2.json();
        if (!r2.ok) throw new Error(d2.error);
        setProjectId(d2.project.id);
        setSaveState("saved");
        return d2.project.id;
      }
      if (!res.ok) throw new Error(data.error || "We couldn’t save your design.");
      setProjectId(data.project.id);
      setSaveState("saved");
      return data.project.id;
    } catch (e) {
      setSaveState("offline");
      throw e;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, designId, colorwayId, fields, showQr, artQrStyle, qrTarget, cleanedUrl, peaks, assetId, rights]);

  // ── Autosave to the server once there is a recording (so the design follows the customer) ──
  useEffect(() => {
    if (!loaded || !assetId || !peaks || urlInvalid) return;
    const t = setTimeout(() => void saveProject().catch(() => undefined), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, assetId, designId, colorwayId, fields, qr, qrTarget, listenUrl, rights]);

  useEffect(() => {
    if (peaks && assetId) track("design_generated", { design_id: design.id, occasion: occasionId }, { onceKey: `${design.id}:${assetId}` });
  }, [design.id, peaks, assetId, occasionId]);

  const chooseDesign = (id: string, cwId?: string) => {
    const d = getSellableDesign(id);
    if (!d) return;
    setDesignId(id);
    setDesignChosen(true);
    setColorwayId(d.colorways.find((c) => c.id === cwId)?.id ?? d.colorways[0].id);
    track("design_selected", { design_id: id, occasion: occasionId, source: "studio" }, { onceKey: id });
  };

  const chooseOccasion = (id: string) => {
    const o = OCCASIONS.find((x) => x.id === id);
    if (!o) return;
    setOccasionId(id);
    if (!designChosen) {
      const d = getSellableDesign(o.designId)!;
      setDesignId(d.id);
      setColorwayId(d.colorways.find((c) => c.id === o.colorwayId)?.id ?? d.colorways[0].id);
    }
  };

  const setField = (key: FieldKey, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    if (!startedRef.current) {
      startedRef.current = true;
      track("customizer_started", { design_id: design.id, occasion: occasionId });
    }
    setTouched(true);
  };

  const previewFields: ArtFields = useMemo(() => (touched ? fields : design.sample), [touched, fields, design]);
  const missing = design.fields.filter((f) => f.required && !(fields[f.key] ?? "").trim());
  const problems: string[] = [];
  if (mem.state.phase !== "ready" || !assetId) problems.push("Add your recording or video (step 1).");
  if (missing.length) problems.push(`Fill in: ${missing.map((f) => f.label).join(", ")} (step 3).`);
  if (urlInvalid || (qrTarget === "link" && showQr && !cleanedUrl)) problems.push("Add a valid listen link, or let the code play your recording (step 3).");
  if (!rights) problems.push("Confirm you made the recording or have permission to use it.");

  useEffect(() => {
    if (!problems.length && !completedRef.current && loaded) {
      completedRef.current = true;
      track("customization_completed", { design_id: design.id, occasion: occasionId });
    }
  });

  const goto = (i: number) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, i)));
    panelRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const addToCart = async () => {
    setOrderError(null);
    if (problems.length) {
      setOrderError(problems.join(" "));
      return;
    }
    if (!variant) return;
    setBusy(true);
    try {
      const pid = await saveProject();
      const finish = variant.format === "framed" ? frameFinish : null;
      const res = editItem
        ? await fetch(`/api/cart/items/${editItem.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ variantId: variant.id, frameFinish: finish, quantity }) })
        : await fetch("/api/cart/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: pid, variantId: variant.id, frameFinish: finish, quantity }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "We couldn’t add that to your cart. Please try again.");
      track("add_to_cart", { design_id: design.id, occasion: occasionId, size: variant.sizeId, format: variant.format, value: price / 100, currency: "USD", quantity });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      window.location.href = "/cart?added=1";
    } catch (err) {
      setOrderError((err as Error).message);
      setBusy(false);
    }
  };

  const inputCls = "w-full h-12 border-2 border-ink bg-paper px-3 text-[16px] focus:outline-none focus:bg-white";
  const phase = mem.state.phase;

  // ── Panels ────────────────────────────────────────────────────────────
  const memoryPanel = (
    <div className="space-y-6">
      <div>
        <h2 className="display text-5xl">Add your memory</h2>
        <p className="mt-3 text-lg leading-relaxed text-ink-soft">
          Upload an audio or video recording — a voice memo, wedding clip, saved voicemail, baby laugh, pet sound, Snapchat memory, or anything else you’re permitted to use.
        </p>
      </div>
      <div>
        <p className="meta mb-2">What’s it for? (optional)</p>
        <div className="flex flex-wrap gap-2">
          {OCCASIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => chooseOccasion(o.id)}
              aria-pressed={occasionId === o.id}
              className={`min-h-[44px] border-2 border-ink px-3 text-sm ${occasionId === o.id ? "bg-ink text-paper" : "bg-transparent hover:bg-paper-2"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {occasion && <p className="mt-3 text-sm leading-relaxed text-ink-soft">{occasion.recordingPrompt}</p>}
      </div>

      {phase === "ready" && mem.info ? (
        <div className="border-2 border-ink bg-paper-2 p-4">
          <div className="flex items-start justify-between gap-4">
            <Meta
              rows={[
                ["Source", mem.info.source === "video" ? "Video (sound only)" : mem.info.source === "recording" ? "Voice recording" : "Audio"],
                ["File", mem.info.fileName],
                ["Length", formatLength(mem.info.duration)],
              ]}
            />
            <button
              type="button"
              onClick={() => {
                mem.reset();
                setAssetId(null);
                setPeaks(null);
              }}
              className="meta min-h-[44px] underline"
            >
              Replace
            </button>
          </div>
          {peaks && <WaveBars peaks={peaks} className="mt-4 h-10 w-full" count={80} />}
          <p className="mt-3 text-sm text-[#2F6B3A]">✓ Your artwork is now shaped by this recording.</p>
        </div>
      ) : (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void mem.handle(f, f.name);
          }}
          className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-ink bg-paper-2 p-6 text-center hover:bg-[#e2dac9]"
        >
          <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => e.target.files?.[0] && mem.handle(e.target.files[0], e.target.files[0].name)} />
          {phase === "idle" || phase === "error" ? (
            <>
              <span className="display text-3xl">Choose a recording or video</span>
              <span className="text-sm text-ink-soft">or drop it here · MP4, MOV, M4V, M4A, MP3, WAV, AAC · up to 3 minutes</span>
            </>
          ) : (
            <>
              <span className="display text-3xl" aria-live="polite">
                {phase === "reading"
                  ? "Opening your file…"
                  : phase === "extracting"
                  ? "Listening to your recording…"
                  : phase === "verifying"
                  ? "Checking the upload…"
                  : `Saving the sound… ${mem.state.phase === "uploading" ? Math.round(mem.state.progress * 100) : 0}%`}
              </span>
              {mem.state.phase === "uploading" && (
                <span className="mt-1 block h-2 w-full max-w-xs border-2 border-ink" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(mem.state.progress * 100)} aria-label="Upload progress">
                  <span className="block h-full bg-signal transition-[width]" style={{ width: `${Math.round(mem.state.progress * 100)}%` }} />
                </span>
              )}
              <span className="meta opacity-70">{"name" in mem.state ? mem.state.name : ""}</span>
              <span className="mt-2 flex h-6 items-end gap-1" aria-hidden>
                {Array.from({ length: 14 }, (_, i) => (
                  <span key={i} className="anim-blink w-1 bg-ink" style={{ height: `${6 + ((i * 7) % 18)}px`, animationDelay: `${i * 80}ms` }} />
                ))}
              </span>
            </>
          )}
        </label>
      )}
      {phase === "error" && mem.state.phase === "error" && (
        <div role="alert" className="border-2 border-[#B2361B] bg-[#FBE7E1] p-4 text-sm text-[#7E2512]">
          {mem.state.message}
          {(mem.state.code === "network" || mem.state.code === "server") && mem.canRetry() && (
            <button type="button" onClick={mem.retry} className="ml-2 font-semibold underline">
              Try again
            </button>
          )}
        </div>
      )}
      {phase !== "ready" && <Recorder onDone={(b) => mem.handle(b, "Voice recording", "recording")} />}
      <p className="meta opacity-70">Videos: your browser pulls out the soundtrack and only the sound is uploaded.</p>
      <label className="flex items-start gap-3 text-[15px]">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-1 h-5 w-5 accent-[#151412]" />
        <span>I made this recording or have permission to use it.</span>
      </label>
    </div>
  );

  const artworkPanel = (
    <div className="space-y-6">
      <h2 className="display text-5xl">Choose your artwork</h2>
      <div className="grid grid-cols-2 gap-4">
        {DESIGNS.map((d) => (
          <button key={d.id} type="button" onClick={() => chooseDesign(d.id)} aria-pressed={d.id === design.id} className={`text-left border-2 border-ink p-2 ${d.id === design.id ? "bg-ink text-paper shadow-[4px_4px_0_#FF5B2E]" : "bg-paper hover:bg-paper-2"}`}>
            <Artwork designId={d.id} fields={d.sample} peaks={peaks} colorwayId={d.id === design.id ? colorwayId : undefined} showQr={false} idPrefix={`pick-${d.id}`} />
            <span className="display mt-3 block text-2xl">{d.name}</span>
            <span className="mt-1 block text-sm opacity-80">{d.tagline}</span>
          </button>
        ))}
      </div>
      <div>
        <p className="meta mb-2">Colour</p>
        <div className="flex flex-wrap items-center gap-3">
          {design.colorways.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setColorwayId(c.id)}
              aria-pressed={colorwayId === c.id}
              className={`flex min-h-[44px] items-center gap-2 border-2 px-2.5 ${colorwayId === c.id ? "border-ink bg-paper-2" : "border-transparent"}`}
            >
              <span className="h-7 w-7 rounded-full border-2 border-ink" style={{ background: `linear-gradient(135deg, ${c.swatch[0]} 50%, ${c.swatch[1]} 50%)` }} />
              <span className="text-sm">{c.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const detailFields = design.fields.filter((f) => f.key !== "song");
  const songField = design.fields.find((f) => f.key === "song");
  const detailsPanel = (
    <div className="space-y-7">
      <h2 className="display text-5xl">Tell its story</h2>
      <div className="space-y-4">
        {detailFields.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 flex justify-between text-[15px] font-medium">
              <span>
                {f.label}
                {!f.required && <span className="font-normal text-ink-soft"> · optional</span>}
              </span>
              <span className="meta opacity-60">
                {(fields[f.key] ?? "").length}/{f.maxLength}
              </span>
            </span>
            {f.key === "date" && design.id === "night-of" ? (
              <input type="date" value={fields.date} onChange={(e) => setField("date", e.target.value)} className={inputCls} />
            ) : f.multiline ? (
              <textarea rows={2} maxLength={f.maxLength} value={fields[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setField(f.key, e.target.value)} className={`${inputCls} h-auto py-2.5`} />
            ) : (
              <input type="text" maxLength={f.maxLength} value={fields[f.key] ?? ""} placeholder={f.key === "date" ? "e.g. June 14, 2025" : f.placeholder} onChange={(e) => setField(f.key, e.target.value)} className={inputCls} />
            )}
            {f.hint && <span className="mt-1 block text-sm text-ink-soft">{f.hint}</span>}
          </label>
        ))}
      </div>

      {songField && (
        <fieldset className="border-2 border-ink p-4">
          <legend className="meta px-2">Add the song behind the memory · optional</legend>
          <p className="mb-3 text-sm text-ink-soft">If a song is part of the story, add its title and artist. It’s printed as a small line — we don’t use the song’s audio.</p>
          <input type="text" maxLength={songField.maxLength} value={fields.song ?? ""} placeholder={songField.placeholder} onChange={(e) => setField("song", e.target.value)} className={inputCls} aria-label="Song title and artist" />
        </fieldset>
      )}

      <fieldset className="border-2 border-ink p-4">
        <legend className="meta px-2">Scan-to-listen code</legend>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["discreet", "Discreet", "Tone-on-tone"],
              ["standard", "Standard", "Easy to spot"],
              ["off", "None", "Art only"],
            ] as const
          ).map(([id, label, note]) => (
            <button key={id} type="button" onClick={() => setQr(id)} aria-pressed={qr === id} className={`min-h-[56px] border-2 border-ink p-2 text-left ${qr === id ? "bg-ink text-paper" : "bg-paper"}`}>
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-xs opacity-75">{note}</span>
            </button>
          ))}
        </div>
        {showQr && (
          <div className="mt-4 space-y-3">
            <p className="meta">When scanned, it…</p>
            <label className="flex items-start gap-3 text-[15px]">
              <input type="radio" name="qrTarget" checked={qrTarget === "recording"} onChange={() => setQrTarget("recording")} className="mt-1 h-5 w-5 accent-[#151412]" />
              <span>Plays your uploaded recording, from a private link</span>
            </label>
            <label className="flex items-start gap-3 text-[15px]">
              <input type="radio" name="qrTarget" checked={qrTarget === "link"} onChange={() => setQrTarget("link")} className="mt-1 h-5 w-5 accent-[#151412]" />
              <span>Opens a link you choose</span>
            </label>
            {qrTarget === "link" && (
              <label className="block">
                <span className="mb-1 block text-[15px] font-medium">Listen link</span>
                <input type="url" inputMode="url" value={listenUrl} placeholder="https://open.spotify.com/track/…" onChange={(e) => setListenUrl(e.target.value)} className={inputCls} aria-invalid={urlInvalid} />
                <span className={`mt-1 block text-sm ${urlInvalid ? "text-[#B2361B]" : "text-ink-soft"}`}>
                  {urlInvalid
                    ? "That doesn’t look like a web address."
                    : cleanedUrl
                    ? `The code will open ${listenServiceName(cleanedUrl)}.`
                    : "Paste a public Spotify, Apple Music, YouTube or other link. The code opens it; we don’t use it to make the artwork."}
                </span>
              </label>
            )}
          </div>
        )}
      </fieldset>
    </div>
  );

  const printPanel = (
    <div className="space-y-6">
      <h2 className="display text-5xl">Print &amp; frame</h2>
      <div className="grid grid-cols-2 gap-3">
        {FORMATS.map((f) => (
          <button key={f.id} type="button" onClick={() => setFormat(f.id)} aria-pressed={format === f.id} className={`border-2 border-ink p-3 text-left ${format === f.id ? "bg-ink text-paper" : "bg-paper"}`}>
            <span className="block font-semibold">{f.label}</span>
            <span className="mt-0.5 block text-xs opacity-80">{f.description}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {sizesForFormat.map((v) => {
          const s = getPrintSize(v.sizeId);
          return (
            <button key={v.id} type="button" onClick={() => setSizeId(v.sizeId)} aria-pressed={sizeId === v.sizeId} className={`border-2 border-ink p-3 text-left ${sizeId === v.sizeId ? "bg-ink text-paper" : "bg-paper"}`}>
              <span className="display block text-2xl">{s?.label ?? v.sizeId}</span>
              <span className="block font-semibold">{formatPrice(v.priceCents)}</span>
              {s?.note && <span className="mt-1 block text-[11px] leading-tight opacity-75">{s.note}</span>}
            </button>
          );
        })}
      </div>
      {format === "framed" && finishes.length > 0 && (
        <div>
          <p className="meta mb-2">Frame</p>
          <div className="flex flex-wrap gap-3">
            {finishes.map((f) => (
              <button key={f.id} type="button" onClick={() => setFrameFinish(f.id)} aria-pressed={frameFinish === f.id} className={`flex min-h-[44px] items-center gap-2 border-2 px-2.5 ${frameFinish === f.id ? "border-ink bg-paper-2" : "border-transparent"}`}>
                <span className="h-7 w-7 border-2 border-ink" style={{ background: f.color }} />
                <span className="text-sm">{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="meta mb-2">Quantity</p>
        <div className="inline-flex items-center border-2 border-ink">
          <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} className="h-11 w-11 text-xl disabled:opacity-30" aria-label="One fewer">
            −
          </button>
          <span className="w-10 text-center font-semibold" aria-live="polite" aria-label={`Quantity ${quantity}`}>
            {quantity}
          </span>
          <button type="button" onClick={() => setQuantity((q) => Math.min(10, q + 1))} disabled={quantity >= 10} className="h-11 w-11 text-xl disabled:opacity-30" aria-label="One more">
            +
          </button>
        </div>
        <span className="ml-3 text-sm text-ink-soft">Same design for family? Order extra copies here.</span>
      </div>
      <p className="text-sm text-ink-soft">
        Made to order · free tracked US shipping · usually {variant?.leadTimeMinDays ?? 5}–{variant?.leadTimeMaxDays ?? 9} business days to your door. Delivery dates are estimates.
      </p>
    </div>
  );

  const reviewPanel = (
    <div className="space-y-6">
      <h2 className="display text-5xl">Review</h2>
      <Meta
        className="!text-[12px]"
        rows={[
          ["Artwork", `${design.name} · ${design.colorways.find((c) => c.id === colorwayId)?.name}`],
          ["Source", mem.info ? `${mem.info.fileName} · ${formatLength(mem.info.duration)}` : "— not added yet"],
          ["Print", `${size.label} ${format === "framed" ? `framed · ${frameFinish}` : "print only"}${quantity > 1 ? ` · × ${quantity}` : ""}`],
          ["Code", showQr ? `${qr === "discreet" ? "Discreet" : "Standard"} · ${qrTarget === "link" && cleanedUrl ? `opens ${listenServiceName(cleanedUrl)}` : "plays your recording"}` : "None"],
          ["Price", `${formatPrice(price)} incl. US shipping · tax calculated at checkout`],
        ]}
      />
      <p className="text-[15px]">Please check names and dates — we print exactly what you see.</p>
      <label className="flex items-start gap-3 text-[15px]">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-1 h-5 w-5 accent-[#151412]" />
        <span>I made this recording or have permission to use it.</span>
      </label>
      {problems.length > 0 && (
        <ul className="space-y-1 text-sm text-[#7E2512]">
          {problems.map((p) => (
            <li key={p}>· {p}</li>
          ))}
        </ul>
      )}
      <button type="button" onClick={addToCart} disabled={busy} className="btn btn-signal w-full justify-between disabled:opacity-60">
        <span>{busy ? "Saving your piece…" : `${editItem ? "Update cart" : "Add to cart"} — ${formatPrice(price)}`}</span>
        <span className="btn-arrow" aria-hidden>
          →
        </span>
      </button>
      {orderError && (
        <p role="alert" className="text-sm text-[#7E2512]">
          {orderError}
        </p>
      )}
      <p className="text-sm text-ink-soft">Damaged, or not as previewed? We reprint it free.</p>
      <p className="text-sm text-ink-soft">
        By ordering you agree to our{" "}
        <Link href="/terms" target="_blank" className="underline underline-offset-2">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" target="_blank" className="underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );

  const panels = [memoryPanel, artworkPanel, detailsPanel, printPanel, reviewPanel];
  const stepDone = [phase === "ready" && Boolean(assetId) && rights, designChosen || step > 1, touched && missing.length === 0, step > 3, false];

  const preview = (
    <div className="bg-paper-2 px-[10%] py-[8%]">
      <FramedArtwork
        designId={design.id}
        fields={previewFields}
        peaks={peaks}
        colorwayId={colorwayId}
        widthIn={size.widthIn}
        heightIn={size.heightIn}
        showQr={showQr}
        qrStyle={artQrStyle}
        format={format}
        frameFinish={frameFinish}
        idPrefix="studio"
        title={`${design.name} preview`}
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-12 pt-6 sm:px-8 lg:pb-16">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
        {/* Preview */}
        <div className="lg:sticky lg:top-24">
          <div className="mb-3 flex items-center justify-between lg:hidden">
            <span className="meta">Live preview</span>
            <button type="button" onClick={() => setShowPreview(!showPreview)} className="meta min-h-[44px] underline" aria-expanded={showPreview}>
              {showPreview ? "Hide preview" : "Show preview"}
            </button>
          </div>
          <div className={`${showPreview ? "" : "hidden"} lg:block ${loaded ? "" : "animate-pulse opacity-60"}`} aria-busy={!loaded}>
            <div className="mx-auto max-w-[290px] sm:max-w-[440px] lg:max-w-none">{preview}</div>
            <p className="meta mt-3 opacity-70">
              {!touched ? "Showing example words until you add yours." : peaks ? "This is exactly what we print." : "Add your recording to see its real shape."}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div ref={panelRef} className="scroll-mt-24">
          {restored && (
            <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 border-2 border-ink bg-film px-4 py-3 text-sm">
              <span>We restored the design you were working on.</span>
              <button type="button" onClick={reset} className="meta min-h-[44px] underline">
                Start over
              </button>
            </div>
          )}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="meta opacity-70" aria-live="polite">
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "✓ Saved" : saveState === "offline" ? "Saved on this device (offline)" : "Your work saves automatically"}
            </span>
            <span className="flex gap-1">
              <button type="button" onClick={undo} disabled={!history.length} className="meta min-h-[44px] px-2 underline disabled:no-underline disabled:opacity-30">
                ↶ Undo
              </button>
              <button type="button" onClick={reset} className="meta min-h-[44px] px-2 underline">
                Reset
              </button>
            </span>
          </div>
          <nav aria-label="Steps" className="mb-8">
            <ol className="grid grid-cols-5 border-2 border-ink">
              {STEPS.map((s, i) => (
                <li key={s} className={i ? "border-l-2 border-ink" : ""}>
                  <button
                    type="button"
                    onClick={() => goto(i)}
                    aria-current={step === i ? "step" : undefined}
                    className={`flex min-h-[52px] w-full flex-col items-start justify-center px-2 text-left sm:px-3 ${step === i ? "bg-ink text-paper" : "hover:bg-paper-2"}`}
                  >
                    <span className="meta !text-[10px] opacity-70">
                      {stepDone[i] && step !== i ? "✓" : `0${i + 1}`}
                    </span>
                    <span className="truncate text-[13px] font-semibold sm:text-sm">{s}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          {panels[step]}

          <div className="mt-10 hidden items-center justify-between border-t-2 border-ink pt-5 lg:flex">
            <button type="button" onClick={() => goto(step - 1)} disabled={step === 0} className="meta min-h-[44px] px-2 underline disabled:opacity-30">
              ← Back
            </button>
            <span className="display text-3xl">{formatPrice(price)}</span>
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => goto(step + 1)} className="btn btn-ink">
                <span>Next: {STEPS[step + 1]}</span>
                <span className="btn-arrow" aria-hidden>
                  →
                </span>
              </button>
            ) : (
              <span className="w-24" />
            )}
          </div>
        </div>
      </div>

      {/* Mobile step bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t-2 border-ink bg-paper px-4 py-3 lg:hidden">
        <button type="button" onClick={() => goto(step - 1)} disabled={step === 0} className="meta min-h-[44px] px-1 underline disabled:opacity-30">
          ← Back
        </button>
        <span className="display text-2xl">{formatPrice(price)}</span>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={() => goto(step + 1)} className="btn btn-ink !min-h-[44px] !text-sm">
            <span>Next</span>
            <span className="btn-arrow !w-10" aria-hidden>
              →
            </span>
          </button>
        ) : (
          <button type="button" onClick={addToCart} disabled={busy} className="btn btn-signal !min-h-[44px] !text-sm">
            <span>{busy ? "Saving…" : editItem ? "Update" : "Add to cart"}</span>
            <span className="btn-arrow !w-10" aria-hidden>
              →
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
