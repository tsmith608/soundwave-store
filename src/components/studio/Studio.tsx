"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Artwork from "@/components/art/Artwork";
import FramedArtwork from "@/components/art/FramedArtwork";
import Meta from "@/components/brand/Meta";
import { WaveBars } from "@/components/brand/shapes";
import { DESIGNS, EMPTY_FIELDS, getSellableDesign, type ArtFields, type FieldKey } from "@/lib/art";
import { DEFAULT_SIZE_ID, FORMATS, FRAME_FINISHES, OCCASIONS, PRINT_SIZES, formatPrice, getPrintSize, type ProductFormat } from "@/lib/catalog";
import { cleanListenUrl, listenServiceName } from "@/lib/listenLink";
import { track } from "@/lib/analytics";
import { ACCEPT, formatLength, useMemoryUpload, type MemoryInfo } from "./useMemoryUpload";

export interface StudioProps {
  initialDesign?: string;
  initialOccasion?: string;
  initialColorway?: string;
  initialSize?: string;
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

export default function Studio({ initialDesign, initialOccasion, initialColorway, initialSize }: StudioProps) {
  const occasion0 = OCCASIONS.find((o) => o.id === initialOccasion);
  const design0 = getSellableDesign(initialDesign) ?? getSellableDesign(LEGACY_TEMPLATE_MAP[initialDesign ?? ""]) ?? getSellableDesign(occasion0?.designId) ?? DESIGNS[0];

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
  const [audioId, setAudioId] = useState<string | null>(null);
  const [rights, setRights] = useState(false);
  const [qr, setQr] = useState<QrChoice>("discreet");
  const [qrTarget, setQrTarget] = useState<"recording" | "link">("recording");
  const [listenUrl, setListenUrl] = useState("");
  const [sizeId, setSizeId] = useState(getPrintSize(initialSize)?.id ?? DEFAULT_SIZE_ID);
  const [format, setFormat] = useState<ProductFormat>("framed");
  const [frameFinish, setFrameFinish] = useState("black");
  const [busy, setBusy] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const startedRef = useRef(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const size = getPrintSize(sizeId)!;
  const price = size.price[format];
  const occasion = OCCASIONS.find((o) => o.id === occasionId);
  const showQr = qr !== "off";
  const artQrStyle = qr === "standard" ? "standard" : "discreet";
  const cleanedUrl = qrTarget === "link" ? cleanListenUrl(listenUrl) : null;
  const urlInvalid = qrTarget === "link" && listenUrl.trim() !== "" && !cleanedUrl;

  useEffect(() => {
    track("design_selected", { design_id: design.id, occasion: occasionId, source: "studio_load" }, { onceKey: design.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onReady = useCallback(
    ({ peaks: p, audioId: id, info }: { peaks: number[]; audioId: string; info: MemoryInfo }) => {
      setPeaks(p);
      setAudioId(id);
      track("audio_uploaded", { design_id: design.id, occasion: occasionId, source_type: info.source, duration_s: Math.round(info.duration) });
    },
    [design.id, occasionId]
  );
  const mem = useMemoryUpload(onReady);

  useEffect(() => {
    if (peaks && audioId) track("preview_generated", { design_id: design.id, occasion: occasionId }, { onceKey: `${design.id}:${audioId}` });
  }, [design.id, peaks, audioId, occasionId]);

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
      track("personalization_started", { design_id: design.id, occasion: occasionId });
    }
    setTouched(true);
  };

  const previewFields: ArtFields = useMemo(() => (touched ? fields : design.sample), [touched, fields, design]);
  const missing = design.fields.filter((f) => f.required && !(fields[f.key] ?? "").trim());
  const problems: string[] = [];
  if (mem.state.phase !== "ready") problems.push("Add your recording or video (step 1).");
  if (missing.length) problems.push(`Fill in: ${missing.map((f) => f.label).join(", ")} (step 3).`);
  if (urlInvalid || (qrTarget === "link" && showQr && !cleanedUrl)) problems.push("Add a valid listen link, or let the code play your recording (step 3).");
  if (!rights) problems.push("Confirm you made the recording or have permission to use it.");

  const goto = (i: number) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, i)));
    panelRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const order = async () => {
    setOrderError(null);
    if (problems.length) {
      setOrderError(problems.join(" "));
      return;
    }
    setBusy(true);
    const params = { design_id: design.id, occasion: occasionId, size: size.id, format, value: price / 100, currency: "USD" };
    track("add_to_cart", params);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          designId: design.id,
          colorwayId,
          fields,
          peaks,
          audioId,
          showQr,
          qrStyle: artQrStyle,
          listenUrl: showQr && qrTarget === "link" ? cleanedUrl : null,
          rightsConfirmed: rights,
          size: size.id,
          format,
          frameFinish,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) throw new Error(data.error || "Something went wrong. Please try again.");
      track("checkout_initiated", { ...params, order_id: data.orderId });
      window.location.href = data.checkoutUrl;
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
            <button type="button" onClick={mem.reset} className="meta underline">
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
                {phase === "reading" ? "Opening your file…" : phase === "extracting" ? "Listening to your recording…" : "Saving the sound…"}
              </span>
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
          {mem.state.code === "network" && mem.canRetry() && (
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
        {PRINT_SIZES.map((s) => (
          <button key={s.id} type="button" onClick={() => setSizeId(s.id)} aria-pressed={sizeId === s.id} className={`border-2 border-ink p-3 text-left ${sizeId === s.id ? "bg-ink text-paper" : "bg-paper"}`}>
            <span className="display block text-2xl">{s.label}</span>
            <span className="block font-semibold">{formatPrice(s.price[format])}</span>
            <span className="mt-1 block text-[11px] leading-tight opacity-75">{s.note}</span>
          </button>
        ))}
      </div>
      {format === "framed" && (
        <div>
          <p className="meta mb-2">Frame</p>
          <div className="flex gap-3">
            {FRAME_FINISHES.map((f) => (
              <button key={f.id} type="button" onClick={() => setFrameFinish(f.id)} aria-pressed={frameFinish === f.id} className={`flex min-h-[44px] items-center gap-2 border-2 px-2.5 ${frameFinish === f.id ? "border-ink bg-paper-2" : "border-transparent"}`}>
                <span className="h-7 w-7 border-2 border-ink" style={{ background: f.color }} />
                <span className="text-sm">{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="text-sm text-ink-soft">Made to order in 3–5 business days · free tracked US shipping · usually 5–9 business days in total.</p>
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
          ["Print", `${size.label} ${format === "framed" ? `framed · ${frameFinish}` : "print only"}`],
          ["Code", showQr ? `${qr === "discreet" ? "Discreet" : "Standard"} · ${qrTarget === "link" && cleanedUrl ? `opens ${listenServiceName(cleanedUrl)}` : "plays your recording"}` : "None"],
          ["Price", `${formatPrice(price)} incl. US shipping`],
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
      <button type="button" onClick={order} disabled={busy} className="btn btn-signal w-full justify-between disabled:opacity-60">
        <span>{busy ? "Saving your piece…" : `Order — ${formatPrice(price)}`}</span>
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
  const stepDone = [phase === "ready" && rights, designChosen || step > 1, touched && missing.length === 0, step > 3, false];

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
          <div className={`${showPreview ? "" : "hidden"} lg:block`}>
            <div className="mx-auto max-w-[290px] sm:max-w-[440px] lg:max-w-none">{preview}</div>
            <p className="meta mt-3 opacity-70">
              {!touched ? "Showing example words until you add yours." : peaks ? "This is exactly what we print." : "Add your recording to see its real shape."}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div ref={panelRef} className="scroll-mt-24">
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
          <button type="button" onClick={order} disabled={busy} className="btn btn-signal !min-h-[44px] !text-sm">
            <span>{busy ? "Saving…" : "Order"}</span>
            <span className="btn-arrow !w-10" aria-hidden>
              →
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
