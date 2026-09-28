"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AudioRecorder from "@/components/AudioRecorder";
import Artwork from "@/components/art/Artwork";
import FramedArtwork from "@/components/art/FramedArtwork";
import { blobToWav } from "@/lib/art/peaks";
import { DESIGNS, EMPTY_FIELDS, decodePeaksFromBlob, getSellableDesign, type ArtFields, type FieldKey } from "@/lib/art";
import { DEFAULT_SIZE_ID, FORMATS, FRAME_FINISHES, OCCASIONS, PRINT_SIZES, formatPrice, getPrintSize, type ProductFormat } from "@/lib/catalog";
import { track } from "@/lib/analytics";

export interface StudioProps {
  initialDesign?: string;
  initialOccasion?: string;
  initialColorway?: string;
  initialSize?: string;
}

const LEGACY_TEMPLATE_MAP: Record<string, string> = {
  botanical: "herbarium",
  celestial: "night-of",
  arch: "arch",
  minimal: "in-memoriam",
  modern_border: "liner-notes",
  art_deco: "liner-notes",
  luxury_marble: "arch",
  vintage_grunge: "liner-notes",
  abstract_geometric: "liner-notes",
};

function Step({ n, title, children, id }: { n: number; title: string; children: React.ReactNode; id: string }) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-[#E6DFD6] pt-7 pb-8 first:border-t-0 first:pt-0">
      <h2 className="flex items-baseline gap-3 mb-5">
        <span className="text-[11px] font-mono text-[#9E968F]">0{n}</span>
        <span className="font-serif text-2xl text-[#2D2A26]">{title}</span>
      </h2>
      {children}
    </section>
  );
}

export default function Studio({ initialDesign, initialOccasion, initialColorway, initialSize }: StudioProps) {
  const occasion0 = OCCASIONS.find((o) => o.id === initialOccasion);
  const design0 =
    getSellableDesign(initialDesign) ??
    getSellableDesign(LEGACY_TEMPLATE_MAP[initialDesign ?? ""]) ??
    getSellableDesign(occasion0?.designId) ??
    DESIGNS[0];

  const [occasionId, setOccasionId] = useState<string | undefined>(occasion0?.id);
  const [designId, setDesignId] = useState(design0.id);
  const design = getSellableDesign(designId) ?? DESIGNS[0];
  const [colorwayId, setColorwayId] = useState(
    design0.colorways.find((c) => c.id === initialColorway)?.id ?? (occasion0?.designId === design0.id ? occasion0?.colorwayId : undefined) ?? design0.colorways[0].id
  );
  const [fields, setFields] = useState<ArtFields>({ ...EMPTY_FIELDS });
  const [touched, setTouched] = useState(false);

  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [audioId, setAudioId] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioState, setAudioState] = useState<"idle" | "processing" | "ready" | "error">("idle");
  const [audioError, setAudioError] = useState<string | null>(null);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [showQr, setShowQr] = useState(true);
  const [sizeId, setSizeId] = useState(getPrintSize(initialSize)?.id ?? DEFAULT_SIZE_ID);
  const [format, setFormat] = useState<ProductFormat>("framed");
  const [frameFinish, setFrameFinish] = useState<string>("black");
  const [busy, setBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"frame" | "flat">("frame");

  const size = getPrintSize(sizeId)!;
  const price = size.price[format];
  const occasion = OCCASIONS.find((o) => o.id === occasionId);
  const startedRef = useRef(false);

  useEffect(() => {
    track("design_selected", { design_id: design.id, occasion: occasionId, source: "studio_load" }, { onceKey: design.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseDesign = (id: string, cwId?: string) => {
    const d = getSellableDesign(id);
    if (!d) return;
    setDesignId(id);
    setColorwayId(d.colorways.find((c) => c.id === cwId)?.id ?? d.colorways[0].id);
    if (!d.supportsPhoto) {
      setPhotoUrl(null);
      setPhotoId(null);
    }
    track("design_selected", { design_id: id, occasion: occasionId, source: "studio" }, { onceKey: id });
  };

  const chooseOccasion = (id: string) => {
    const o = OCCASIONS.find((x) => x.id === id);
    if (!o) return;
    setOccasionId(id);
    if (!touched) chooseDesign(o.designId, o.colorwayId);
  };

  const setField = (key: FieldKey, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    if (!startedRef.current) {
      startedRef.current = true;
      track("personalization_started", { design_id: design.id, occasion: occasionId });
    }
    setTouched(true);
  };

  /** Until the customer types, the preview shows the design's example words. */
  const previewFields: ArtFields = useMemo(() => {
    if (touched) return fields;
    return design.sample;
  }, [touched, fields, design]);

  const handleAudio = useCallback(
    async (blob: Blob, file?: File) => {
      setAudioState("processing");
      setAudioError(null);
      setAudioName(file?.name ?? "Your recording");
      try {
        const { peaks: p, duration } = await decodePeaksFromBlob(blob);
        if (duration < 0.5) throw new Error("That recording is too short — try at least a second or two.");
        setPeaks(p);
        const form = new FormData();
        const directOk = file ? /\.(mp3|wav|webm|m4a)$/i.test(file.name) : /webm|wav|mpeg/.test(blob.type);
        if (directOk) form.append("audio", file ?? new File([blob], "recording.webm", { type: blob.type || "audio/webm" }));
        else form.append("audio", new File([await blobToWav(blob)], "recording.wav", { type: "audio/wav" }));
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.audioId) throw new Error(data.error || "We couldn't save that file. MP3, M4A, WAV and WebM up to 50 MB work.");
        setAudioId(data.audioId);
        setAudioState("ready");
        track("audio_uploaded", { design_id: design.id, occasion: occasionId, duration_s: Math.round(duration) });
      } catch (err) {
        setAudioState("error");
        setAudioError((err as Error).message || "We couldn't read that file. Try an MP3, M4A or WAV.");
      }
    },
    [design.id, occasionId]
  );

  useEffect(() => {
    if (peaks && audioId) track("preview_generated", { design_id: design.id, occasion: occasionId }, { onceKey: `${design.id}:${audioId}` });
  }, [design.id, peaks, audioId, occasionId]);

  const handlePhoto = async (file: File) => {
    if (!/\.(jpe?g|png)$/i.test(file.name) || file.size > 25 * 1024 * 1024) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
    setPhotoBusy(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (data.photoId) setPhotoId(data.photoId);
    } finally {
      setPhotoBusy(false);
    }
  };

  const missing = design.fields.filter((f) => f.required && !fields[f.key].trim());
  const ready = audioState === "ready" && missing.length === 0 && (!photoUrl || !!photoId);

  const checkout = async () => {
    setCheckoutError(null);
    if (!ready) {
      setCheckoutError(audioState !== "ready" ? "Add your recording first." : `Please fill in: ${missing.map((f) => f.label).join(", ")}.`);
      return;
    }
    setBusy(true);
    const params = { design_id: design.id, occasion: occasionId, size: size.id, format, value: price / 100, currency: "USD" };
    track("add_to_cart", params);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ designId: design.id, colorwayId, fields, peaks, audioId, photoId, showQr, size: size.id, format, frameFinish }),
      });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) throw new Error(data.error || "Something went wrong. Please try again.");
      track("checkout_initiated", { ...params, order_id: data.orderId });
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setCheckoutError((err as Error).message);
      setBusy(false);
    }
  };

  const preview = (
    <div className="w-full">
      <div className="bg-[#EDE8E1] rounded-sm px-[9%] py-[8%]">
        {previewMode === "frame" ? (
          <FramedArtwork
            designId={design.id}
            fields={previewFields}
            peaks={peaks}
            colorwayId={colorwayId}
            widthIn={size.widthIn}
            heightIn={size.heightIn}
            showQr={showQr}
            photoHref={design.supportsPhoto ? photoUrl : null}
            format={format}
            frameFinish={frameFinish}
            idPrefix="studio"
            title={`${design.name} preview`}
          />
        ) : (
          <Artwork
            designId={design.id}
            fields={previewFields}
            peaks={peaks}
            colorwayId={colorwayId}
            widthIn={size.widthIn}
            heightIn={size.heightIn}
            showQr={showQr}
            photoHref={design.supportsPhoto ? photoUrl : null}
            idPrefix="studioflat"
            className="shadow-[0_12px_30px_rgba(40,30,20,.15)]"
          />
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[#7A736B]">
        <span>
          {!touched ? "Showing example words — yours appear as you type." : peaks ? "This is exactly what we print." : "Add your recording to see its real shape."}
        </span>
        <div className="flex gap-1">
          {(["frame", "flat"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setPreviewMode(m)}
              className={`px-2.5 py-1 rounded-full border ${previewMode === m ? "border-[#2D2A26] text-[#2D2A26]" : "border-transparent"}`}
            >
              {m === "frame" ? "As delivered" : "Artwork only"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-10 lg:gap-16 items-start">
        <div className="lg:sticky lg:top-24">{preview}</div>

        <div>
          <Step n={1} title="Choose a design" id="design">
            <p className="text-sm text-[#6B655F] mb-3">What is it for?</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {OCCASIONS.map((o) => (
                <button
                  key={o.id}
                  onClick={() => chooseOccasion(o.id)}
                  className={`px-3.5 py-1.5 rounded-full text-sm border transition-colors ${
                    occasionId === o.id ? "bg-[#2D2A26] text-white border-[#2D2A26]" : "border-[#DDD5CB] text-[#4A453F] hover:border-[#2D2A26]"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {DESIGNS.map((d) => (
                <button key={d.id} onClick={() => chooseDesign(d.id)} className="group text-left" aria-pressed={d.id === design.id}>
                  <div className={`p-1 rounded-sm transition ${d.id === design.id ? "ring-2 ring-[#2D2A26]" : "ring-1 ring-transparent group-hover:ring-[#CFC6BA]"}`}>
                    <Artwork designId={d.id} fields={d.sample} colorwayId={d.id === design.id ? colorwayId : undefined} idPrefix={`thumb-${d.id}`} showQr={false} />
                  </div>
                  <div className="mt-2 text-[13px] font-medium text-[#2D2A26] leading-tight">{d.name}</div>
                  <div className="text-[11px] text-[#9E968F]">{d.direction}</div>
                </button>
              ))}
            </div>
            <p className="mt-5 text-sm text-[#4A453F] leading-relaxed">{design.tagline}</p>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-xs text-[#7A736B]">Colour</span>
              {design.colorways.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setColorwayId(c.id)}
                  title={c.name}
                  aria-label={c.name}
                  className={`w-8 h-8 rounded-full border overflow-hidden ${colorwayId === c.id ? "ring-2 ring-offset-2 ring-[#2D2A26]" : "border-[#D8D0C6]"}`}
                  style={{ background: `linear-gradient(135deg, ${c.swatch[0]} 50%, ${c.swatch[1]} 50%)` }}
                />
              ))}
              <span className="text-xs text-[#4A453F]">{design.colorways.find((c) => c.id === colorwayId)?.name}</span>
            </div>
          </Step>

          <Step n={2} title="Add the recording" id="recording">
            {occasion && <p className="text-sm text-[#6B655F] mb-4 leading-relaxed">{occasion.recordingPrompt}</p>}
            <AudioRecorder onAudioReady={handleAudio} />
            <div className="mt-3 text-sm min-h-[1.5rem]" aria-live="polite">
              {audioState === "processing" && <span className="text-[#6B655F]">Reading {audioName}…</span>}
              {audioState === "ready" && <span className="text-[#3F6B45]">✓ {audioName} added — the artwork now uses its real shape.</span>}
              {audioState === "error" && <span className="text-[#A3402C]">{audioError}</span>}
            </div>
            <p className="text-xs text-[#9E968F] mt-1">Any length works — a 4-second voicemail or a whole song. We never publish your recording; it plays only for people who scan your print.</p>
          </Step>

          <Step n={3} title="Add your words" id="words">
            <div className="space-y-4">
              {design.fields.map((f) => (
                <label key={f.key} className="block">
                  <span className="flex justify-between text-sm text-[#2D2A26] mb-1">
                    <span>
                      {f.label}
                      {f.required ? "" : <span className="text-[#9E968F]"> · optional</span>}
                    </span>
                    <span className="text-xs text-[#9E968F]">
                      {fields[f.key].length}/{f.maxLength}
                    </span>
                  </span>
                  {f.key === "date" && design.id === "night-of" ? (
                    <input
                      type="date"
                      value={fields.date}
                      onChange={(e) => setField("date", e.target.value)}
                      className="w-full rounded-md border border-[#DDD5CB] bg-white px-3 py-2.5 text-[15px] focus:outline-none focus:border-[#2D2A26]"
                    />
                  ) : f.multiline ? (
                    <textarea
                      rows={2}
                      maxLength={f.maxLength}
                      value={fields[f.key]}
                      placeholder={f.placeholder}
                      onChange={(e) => setField(f.key, e.target.value)}
                      className="w-full rounded-md border border-[#DDD5CB] bg-white px-3 py-2.5 text-[15px] focus:outline-none focus:border-[#2D2A26] resize-none"
                    />
                  ) : (
                    <input
                      type="text"
                      maxLength={f.maxLength}
                      value={fields[f.key]}
                      placeholder={f.key === "date" ? "e.g. June 14, 2025" : f.placeholder}
                      onChange={(e) => setField(f.key, e.target.value)}
                      className="w-full rounded-md border border-[#DDD5CB] bg-white px-3 py-2.5 text-[15px] focus:outline-none focus:border-[#2D2A26]"
                    />
                  )}
                  {f.hint && <span className="block text-xs text-[#9E968F] mt-1">{f.hint}</span>}
                </label>
              ))}
              {design.supportsPhoto && (
                <div>
                  <span className="block text-sm text-[#2D2A26] mb-1">
                    Photo <span className="text-[#9E968F]">· optional, fills the arch</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer px-4 py-2 rounded-md border border-[#DDD5CB] text-sm hover:border-[#2D2A26]">
                      {photoUrl ? "Replace photo" : "Choose photo"}
                      <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
                    </label>
                    {photoUrl && (
                      <button
                        className="text-sm text-[#7A736B] underline"
                        onClick={() => {
                          setPhotoUrl(null);
                          setPhotoId(null);
                        }}
                      >
                        Remove
                      </button>
                    )}
                    {photoBusy && <span className="text-xs text-[#9E968F]">Uploading…</span>}
                  </div>
                  <span className="block text-xs text-[#9E968F] mt-1">A portrait photo with a simple background works best.</span>
                </div>
              )}
              <label className="flex items-start gap-3 pt-1">
                <input type="checkbox" checked={showQr} onChange={(e) => setShowQr(e.target.checked)} className="mt-1 accent-[#2D2A26]" />
                <span className="text-sm text-[#2D2A26]">
                  Include a scan-to-listen code
                  <span className="block text-xs text-[#9E968F]">Point any phone camera at the print and the recording plays. No app.</span>
                </span>
              </label>
            </div>
          </Step>

          <Step n={4} title="Size and finish" id="size">
            <div className="grid grid-cols-2 gap-2 mb-4">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={`text-left p-3 rounded-md border ${format === f.id ? "border-[#2D2A26] bg-white" : "border-[#DDD5CB]"}`}
                >
                  <div className="text-sm font-medium text-[#2D2A26]">{f.label}</div>
                  <div className="text-xs text-[#7A736B] leading-snug mt-0.5">{f.description}</div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {PRINT_SIZES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSizeId(s.id)}
                  className={`p-3 rounded-md border text-left ${sizeId === s.id ? "border-[#2D2A26] bg-white" : "border-[#DDD5CB]"}`}
                >
                  <div className="text-sm font-medium text-[#2D2A26]">{s.label}</div>
                  <div className="text-sm text-[#2D2A26]">{formatPrice(s.price[format])}</div>
                  <div className="text-[11px] text-[#9E968F] leading-tight mt-1">{s.note}</div>
                </button>
              ))}
            </div>
            {format === "framed" && (
              <div className="mt-4 flex items-center gap-3">
                <span className="text-xs text-[#7A736B]">Frame</span>
                {FRAME_FINISHES.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFrameFinish(f.id)}
                    title={f.label}
                    aria-label={f.label}
                    className={`w-8 h-8 rounded-full border border-[#D8D0C6] ${frameFinish === f.id ? "ring-2 ring-offset-2 ring-[#2D2A26]" : ""}`}
                    style={{ background: f.color }}
                  />
                ))}
                <span className="text-xs text-[#4A453F]">{FRAME_FINISHES.find((f) => f.id === frameFinish)?.label}</span>
              </div>
            )}
          </Step>

          <Step n={5} title="Review and order" id="order">
            <ul className="text-sm text-[#4A453F] space-y-1.5 mb-5">
              <li>
                {design.name} · {design.colorways.find((c) => c.id === colorwayId)?.name} · {size.label} {format === "framed" ? `framed (${frameFinish})` : "print"}
              </li>
              <li>Free tracked US shipping. Printed and shipped in 3–5 business days, delivered in about 5–9.</li>
              <li>Please check spelling — we print exactly what you see.</li>
            </ul>
            <button
              onClick={checkout}
              disabled={busy}
              className="w-full py-4 rounded-md bg-[#2D2A26] hover:bg-black text-white text-sm tracking-wide font-medium transition disabled:opacity-60"
            >
              {busy ? "Saving your design…" : `Order — ${formatPrice(price)}`}
            </button>
            {checkoutError && <p className="mt-3 text-sm text-[#A3402C]">{checkoutError}</p>}
            <p className="mt-3 text-xs text-[#9E968F]">If it arrives damaged or we get anything wrong, we reprint it free.</p>
          </Step>
        </div>
      </div>

      {/* Mobile summary bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#FAF7F2]/95 backdrop-blur border-t border-[#E6DFD6] px-4 py-3 flex items-center justify-between">
        <div className="text-sm">
          <div className="font-medium text-[#2D2A26]">{design.name}</div>
          <div className="text-xs text-[#7A736B]">
            {size.label} · {formatPrice(price)}
          </div>
        </div>
        <a href={ready ? "#order" : audioState !== "ready" ? "#recording" : "#words"} className="px-5 py-2.5 rounded-md bg-[#2D2A26] text-white text-sm">
          {ready ? "Review" : "Continue"}
        </a>
      </div>
    </div>
  );
}
