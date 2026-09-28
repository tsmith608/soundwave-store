// LEGACY (Sep 2026): no longer mounted anywhere. Replaced by src/components/studio/Studio.tsx.
// Kept only because older standalone test scripts in tests/ import-check it.
"use client";

import React, { useState, useRef, useEffect } from "react";
import AudioRecorder from "./AudioRecorder";
import WaveformCanvas from "./WaveformCanvas";
import {
  FRAME_SIZES,
  PALETTES,
  DECORATIVE_STYLES,
  FrameSizeConfig,
  PaletteConfig,
  DecorativeStyle,
} from "@/lib/constants";

export interface PortraitBuilderProps {
  initialTemplate?: string;
  initialPalette?: string;
  initialSize?: string;
  initialCaption?: string;
}

export default function PortraitBuilder({
  initialTemplate,
  initialPalette,
  initialSize,
  initialCaption,
}: PortraitBuilderProps = {}) {
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioId, setAudioId] = useState<string | null>(null);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  // Photo Upload State
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Decorative Style State
  const [decorativeStyle, setDecorativeStyle] = useState<DecorativeStyle>(() => {
    if (initialTemplate) {
      const cleaned = initialTemplate.trim().toLowerCase();
      if (cleaned in DECORATIVE_STYLES) {
        return cleaned as DecorativeStyle;
      }
    }
    return "botanical";
  });

  // Selection states
  const [selectedPalette, setSelectedPalette] = useState<PaletteConfig>(() => {
    if (initialPalette) {
      const cleaned = initialPalette.trim().toLowerCase();
      if (cleaned in PALETTES) {
        return PALETTES[cleaned];
      }
    }
    return PALETTES["blush_rosegold"] || PALETTES["midnight_gold"];
  });
  const [selectedSize, setSelectedSize] = useState<FrameSizeConfig>(() => {
    if (initialSize) {
      const cleaned = initialSize.trim().toLowerCase();
      if (cleaned in FRAME_SIZES) {
        return FRAME_SIZES[cleaned];
      }
    }
    return FRAME_SIZES["16x20"];
  });
  const [caption, setCaption] = useState(initialCaption || "");
  const [elevationScale, setElevationScale] = useState(1.0);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (initialCaption !== undefined) {
      setCaption(initialCaption);
    }
  }, [initialCaption]);

  useEffect(() => {
    if (initialTemplate) {
      const cleaned = initialTemplate.trim().toLowerCase();
      if (cleaned in DECORATIVE_STYLES) {
        setDecorativeStyle(cleaned as DecorativeStyle);
      }
    }
  }, [initialTemplate]);

  useEffect(() => {
    if (initialPalette) {
      const cleaned = initialPalette.trim().toLowerCase();
      if (cleaned in PALETTES) {
        setSelectedPalette(PALETTES[cleaned]);
      }
    }
  }, [initialPalette]);

  useEffect(() => {
    if (initialSize) {
      const cleaned = initialSize.trim().toLowerCase();
      if (cleaned in FRAME_SIZES) {
        setSelectedSize(FRAME_SIZES[cleaned]);
      }
    }
  }, [initialSize]);

  // Revoke object URL on unmount to prevent leaks
  useEffect(() => {
    return () => {
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
      }
    };
  }, [photoUrl]);

  // Handle Photo selection and validation (.jpg, .jpeg, .png)
  const processPhotoFile = async (file: File) => {
    setPhotoError(null);

    const validTypes = ["image/jpeg", "image/png", "image/jpg"];
    const validExts = [".jpg", ".jpeg", ".png"];
    const hasValidExt = validExts.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!validTypes.includes(file.type) && !hasValidExt) {
      setPhotoError("Please upload a valid image file (.jpg, .jpeg, or .png).");
      return;
    }

    // 25 MB max size
    if (file.size > 25 * 1024 * 1024) {
      setPhotoError("Image must be smaller than 25MB.");
      return;
    }

    if (photoUrl) {
      URL.revokeObjectURL(photoUrl);
    }

    const newUrl = URL.createObjectURL(file);
    setPhotoFile(file);
    setPhotoUrl(newUrl);
    setPhotoName(file.name);

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const resp = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.photoId) setPhotoId(data.photoId);
        if (data.photoPath) setPhotoPath(data.photoPath);
      }
    } catch (err) {
      console.warn("Background photo upload error:", err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePhotoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processPhotoFile(file);
    }
  };

  const handlePhotoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingPhoto(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processPhotoFile(file);
    }
  };

  const handleRemovePhoto = () => {
    if (photoUrl) {
      URL.revokeObjectURL(photoUrl);
    }
    setPhotoFile(null);
    setPhotoUrl(null);
    setPhotoName(null);
    setPhotoError(null);
    setPhotoId(null);
    setPhotoPath(null);
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  };

  // When audio is recorded or selected, upload to /api/upload
  const handleAudioReady = async (blob: Blob, file?: File) => {
    setAudioBlob(blob);
    setIsUploading(true);
    setCheckoutError(null);

    try {
      const formData = new FormData();
      const ext = file ? file.name.split(".").pop() : blob.type.includes("webm") ? "webm" : "wav";
      const filename = file ? file.name : `recording_${Date.now()}.${ext}`;
      formData.append("audio", blob, filename);

      const resp = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (resp.ok) {
        const data = await resp.json();
        setAudioId(data.audioId);
        setAudioPath(data.audioPath);
      } else {
        console.warn("Audio upload returned non-200, continuing with local blob preview");
      }
    } catch (err) {
      console.warn("Background audio upload error:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleOrder = async () => {
    setIsCheckingOut(true);
    setCheckoutError(null);

    try {
      let currentPhotoId = photoId;
      let currentPhotoPath = photoPath;

      // If photoFile exists but not uploaded yet, upload now
      if (photoFile && (!currentPhotoId || !currentPhotoPath)) {
        try {
          const formData = new FormData();
          formData.append("photo", photoFile);
          const uploadResp = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          if (uploadResp.ok) {
            const uploadData = await uploadResp.json();
            currentPhotoId = uploadData.photoId || null;
            currentPhotoPath = uploadData.photoPath || null;
            if (currentPhotoId) setPhotoId(currentPhotoId);
            if (currentPhotoPath) setPhotoPath(currentPhotoPath);
          }
        } catch (uErr) {
          console.warn("Photo upload during checkout error:", uErr);
        }
      }

      const payload = {
        audioId: audioId || "aud_sample_demo",
        audioPath: audioPath || undefined,
        photoId: currentPhotoId || undefined,
        photoPath: currentPhotoPath || undefined,
        decorativeStyle,
        frameSize: selectedSize.id,
        palette: selectedPalette.id,
        caption: caption.trim() || undefined,
      };

      const resp = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();

      if (resp.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setCheckoutError(data.error || "Failed to initialize checkout session");
        setIsCheckingOut(false);
      }
    } catch (err: any) {
      console.error("Checkout initiation error:", err);
      setCheckoutError(err.message || "Failed to start checkout");
      setIsCheckingOut(false);
    }
  };

  return (
    <section id="builder" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 scroll-mt-20">
      <div className="text-center mb-10">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#B76E79] bg-[#B76E79]/10 px-3.5 py-1 rounded-full border border-[#B76E79]/20">
          Live Preview Studio
        </span>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif mt-3 text-[#2D2A26]">
          Every Detail,{" "}
          <span className="rosegold-gradient-text italic">Exactly As You Intend It</span>
        </h2>
        <p className="text-[#6B655F] text-sm md:text-base max-w-2xl mx-auto mt-2">
          Upload your photograph, provide the audio, and configure every element of the composition — with a live preview that updates as you build.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Column: Realistic Framed Wall Art Mockup */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="sticky top-24 w-full flex flex-col items-center">
            {/* Outer Wood Frame Container with Physical Aspect Ratio */}
            <div
              className="w-full max-w-[540px] bg-[#FDFBF7] p-6 sm:p-8 md:p-10 rounded-2xl shadow-2xl border-8 border-[#E8DDD1] relative transition-all duration-300"
              style={{
                boxShadow: "0 25px 50px -12px rgba(90, 75, 60, 0.2), inset 0 2px 4px rgba(255,255,255,0.8)",
              }}
            >
              {/* Inner Picture Mat (passe-partout) */}
              <div
                className="w-full rounded-lg overflow-hidden border border-[#EAE3DC] shadow-inner flex items-center justify-center transition-all duration-300 relative"
                style={{
                  aspectRatio: selectedSize.aspectRatio,
                  backgroundColor: selectedPalette.bg,
                }}
              >
                <WaveformCanvas
                  isRecording={isRecording}
                  analyserNode={analyserNode}
                  audioBlob={audioBlob}
                  palette={selectedPalette}
                  caption={caption}
                  elevationScale={elevationScale}
                  photoUrl={photoUrl}
                  decorativeStyle={decorativeStyle}
                />
              </div>

              {/* Physical Dimension Tag */}
              <div className="mt-4 flex items-center justify-between text-xs text-[#6B655F] px-1">
                <span>{selectedSize.name}</span>
                <span className="font-mono text-[#B76E79] font-semibold">{selectedSize.priceFormatted}</span>
              </div>
            </div>

            <p className="text-xs text-[#8C827A] mt-3 text-center">
              Museum-grade archival print • Solid wood frame • Scratch-resistant optical acrylic
            </p>
          </div>
        </div>

        {/* Right Column: Customization Controls */}
        <div className="lg:col-span-5 bg-white border border-[#EAE3DC] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {/* Step 1: Personal Photo Upload */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-[#2D2A26] uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#B76E79] text-white text-xs flex items-center justify-center font-bold">1</span>
                Add Personal Photo
              </label>
              <span className="text-xs text-[#6B655F] font-light">Optional</span>
            </div>

            <input
              type="file"
              ref={photoInputRef}
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              onChange={handlePhotoInputChange}
              className="hidden"
            />

            {!photoUrl ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingPhoto(true);
                }}
                onDragLeave={() => setIsDraggingPhoto(false)}
                onDrop={handlePhotoDrop}
                onClick={() => photoInputRef.current?.click()}
                className={`w-full p-5 rounded-xl border-2 border-dashed cursor-pointer text-center transition-all ${
                  isDraggingPhoto
                    ? "border-[#B76E79] bg-[#B76E79]/5"
                    : "border-[#D8C7B5] bg-[#FAF7F2] hover:border-[#B76E79] hover:bg-white"
                }`}
              >
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-[#FAF7F2] border border-[#EAE3DC] flex items-center justify-center text-[#B76E79]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-[#2D2A26]">
                  Click or drag photo to upload
                </p>
                <p className="text-[11px] text-[#6B655F] mt-0.5">
                  Supports .JPG, .JPEG, or .PNG (up to 25MB)
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F2] border border-[#EAE3DC]">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-lg bg-cover bg-center border border-[#D8C7B5] shrink-0"
                    style={{ backgroundImage: `url(${photoUrl})` }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#2D2A26] truncate">{photoName}</p>
                    <p className="text-[10px] text-emerald-600 font-medium">✓ Photo composited to print</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="text-xs font-medium text-[#B76E79] hover:underline"
                  >
                    Change
                  </button>
                  <span className="text-[#D8C7B5]">•</span>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-xs font-medium text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            {photoError && (
              <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                {photoError}
              </p>
            )}
          </div>

          <div className="h-px bg-[#EAE3DC]" />

          {/* Step 2: Decorative Style Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-[#2D2A26] uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#B76E79] text-white text-xs flex items-center justify-center font-bold">2</span>
                Decorative Border Style
              </label>
              <span className="text-xs text-[#B76E79] font-medium tracking-wide">
                {DECORATIVE_STYLES[decorativeStyle]?.name || "Select Design"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {Object.values(DECORATIVE_STYLES).map((ds) => {
                const isSelected = decorativeStyle === ds.id;
                return (
                  <button
                    key={ds.id}
                    type="button"
                    onClick={() => setDecorativeStyle(ds.id)}
                    className={`relative p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between group ${
                      isSelected
                        ? "border-[#B76E79] bg-white ring-2 ring-[#B76E79]/80 shadow-sm"
                        : "border-[#EAE3DC] bg-[#FAF7F2] hover:border-[#D8C7B5] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5 w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg flex-shrink-0 transition-transform group-hover:scale-110 duration-200">{ds.icon}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#2D2A26] truncate">{ds.name}</p>
                          <p className="text-[10px] text-[#8C827A] truncate capitalize">{ds.subtitle || ds.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                        {ds.primaryColor && (
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-black/10 shadow-xs"
                            style={{ backgroundColor: ds.primaryColor }}
                            title="Primary Color"
                          />
                        )}
                        {ds.accentColor && (
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-black/10 shadow-xs"
                            style={{ backgroundColor: ds.accentColor }}
                            title="Accent Color"
                          />
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-[#6B655F] mt-2 line-clamp-2 leading-relaxed">
                      {ds.description}
                    </p>
                    {isSelected && (
                      <div className="mt-2 pt-1.5 border-t border-[#B76E79]/20 flex items-center justify-between text-[10px] font-semibold text-[#B76E79]">
                        <span className="uppercase tracking-wider text-[9px]">Active Theme</span>
                        <span className="text-xs font-bold">✓</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-[#EAE3DC]" />

          {/* Step 3: Sound Input */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-[#2D2A26] uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#B76E79] text-white text-xs flex items-center justify-center font-bold">3</span>
                Provide Audio Recording
              </label>
              {isUploading && (
                <span className="text-xs text-[#B76E79] animate-pulse font-medium">Syncing audio...</span>
              )}
            </div>
            <AudioRecorder
              onAudioReady={handleAudioReady}
              onAnalyserReady={setAnalyserNode}
              onRecordingChange={setIsRecording}
            />
          </div>

          <div className="h-px bg-[#EAE3DC]" />

          {/* Step 4: Palette Selection */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-[#2D2A26] uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#B76E79] text-white text-xs flex items-center justify-center font-bold">4</span>
              Select Color Palette
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.values(PALETTES).map((p) => {
                const isSelected = selectedPalette.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPalette(p)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-[#B76E79] bg-[#B76E79]/10 ring-1 ring-[#B76E79]"
                        : "border-[#EAE3DC] bg-[#FAF7F2] hover:border-[#D8C7B5] hover:bg-white"
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-full border border-[#D8C7B5] flex items-center justify-center shrink-0 shadow-sm"
                      style={{ backgroundColor: p.bg }}
                    >
                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: p.wave }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#2D2A26] truncate">{p.name}</p>
                      <p className="text-[10px] text-[#6B655F]">{p.label}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-[#EAE3DC]" />

          {/* Step 5: Frame Size & Price */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-[#2D2A26] uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#B76E79] text-white text-xs flex items-center justify-center font-bold">5</span>
              Choose Frame Size
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.values(FRAME_SIZES).map((fs) => {
                const isSelected = selectedSize.id === fs.id;
                return (
                  <button
                    key={fs.id}
                    type="button"
                    onClick={() => setSelectedSize(fs)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-[#B76E79] bg-[#B76E79]/10 ring-1 ring-[#B76E79]"
                        : "border-[#EAE3DC] bg-[#FAF7F2] hover:border-[#D8C7B5] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#2D2A26]">{fs.dimensions}</span>
                      <span className="text-xs font-mono font-bold text-[#B76E79]">{fs.priceFormatted}</span>
                    </div>
                    <p className="text-[10px] text-[#6B655F]">{fs.aspectRatio} ratio</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-[#EAE3DC]" />

          {/* Step 6: Custom Caption */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-[#2D2A26] uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#B76E79] text-white text-xs flex items-center justify-center font-bold">6</span>
                Personal Inscription
              </label>
              <span className={`text-xs ${caption.length > 180 ? "text-amber-600" : "text-[#6B655F]"}`}>
                {caption.length} / 200
              </span>
            </div>
            <input
              type="text"
              maxLength={200}
              placeholder="e.g., Our First Dance — October 12, 2025"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full bg-[#FAF7F2] border border-[#D8C7B5] focus:border-[#B76E79] focus:bg-white rounded-xl px-4 py-3 text-sm text-[#2D2A26] placeholder-[#9E968F] outline-none transition-colors"
            />
          </div>

          {/* Step 7: Waveform Elevation Adjustment */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[#6B655F]">
              <span>Waveform Elevation</span>
              <span className="font-mono font-bold text-[#B76E79]">{Math.round(elevationScale * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={elevationScale}
              onChange={(e) => setElevationScale(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#EAE3DC] rounded-lg appearance-none cursor-pointer accent-[#B76E79]"
            />
          </div>

          {checkoutError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl">
              {checkoutError}
            </div>
          )}

          {/* Checkout Action Button */}
          <button
            type="button"
            onClick={handleOrder}
            disabled={isCheckingOut}
            className="w-full py-4 px-6 rounded-xl font-bold text-base uppercase tracking-wider bg-[#B76E79] hover:bg-[#A05C66] text-white shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {isCheckingOut ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Creating Checkout Session...</span>
              </>
            ) : (
              <>
                <span>Order Custom Print — {selectedSize.priceFormatted}</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-4 text-[11px] text-[#6B655F]">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Stripe 256-Bit SSL
            </span>
            <span>•</span>
            <span>Free US Shipping</span>
            <span>•</span>
            <span>Satisfaction Guarantee</span>
          </div>
        </div>
      </div>
    </section>
  );
}

