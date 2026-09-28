"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { PaletteConfig, DecorativeStyle } from "@/lib/constants";

interface WaveformCanvasProps {
  isRecording?: boolean;
  analyserNode?: AnalyserNode | null;
  audioBlob?: Blob | null;
  palette: PaletteConfig;
  caption?: string;
  elevationScale?: number;
  className?: string;
  photoUrl?: string | null;
  decorativeStyle?: DecorativeStyle;
  previewMode?: boolean;
}

export default function WaveformCanvas({
  isRecording = false,
  analyserNode = null,
  audioBlob = null,
  palette,
  caption = "",
  elevationScale = 1.0,
  className = "",
  photoUrl = null,
  decorativeStyle = "botanical",
  previewMode = false,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [decodedPeaks, setDecodedPeaks] = useState<number[] | null>(null);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);

  // Preload and cache photo image whenever photoUrl changes
  useEffect(() => {
    if (!photoUrl) {
      setLoadedImage(null);
      return;
    }

    let active = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (active) {
        setLoadedImage(img);
      }
    };
    img.onerror = () => {
      if (active) {
        setLoadedImage(null);
      }
    };
    img.src = photoUrl;

    return () => {
      active = false;
    };
  }, [photoUrl]);

  // Decode audio blob into peak bars when audioBlob changes
  useEffect(() => {
    if (previewMode) {
      // Generate a nice-looking static curve for the preview thumbnail
      const fakePeaks = [];
      for (let i = 0; i < 80; i++) {
        // A nice curve that looks like a soundwave
        const val = Math.sin(i * 0.2) * 0.4 + Math.sin(i * 0.05) * 0.3 + 0.3;
        fakePeaks.push(Math.max(0.1, val));
      }
      setDecodedPeaks(fakePeaks);
      return;
    }

    if (!audioBlob || isRecording) {
      setDecodedPeaks(null);
      return;
    }

    let isCancelled = false;
    let audioCtx: AudioContext | null = null;

    const decode = async () => {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx = new AudioContextClass();
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        if (isCancelled) return;

        const rawData = audioBuffer.getChannelData(0);
        const barCount = 80;
        const blockSize = Math.floor(rawData.length / barCount);
        const peaks: number[] = [];

        for (let i = 0; i < barCount; i++) {
          let sum = 0;
          let max = 0;
          const start = i * blockSize;
          for (let j = 0; j < blockSize; j++) {
            const val = Math.abs(rawData[start + j] || 0);
            sum += val;
            if (val > max) max = val;
          }
          const rms = Math.sqrt(sum / blockSize);
          const combined = 0.6 * max + 0.4 * rms;
          peaks.push(combined);
        }

        const maxPeak = Math.max(...peaks, 0.001);
        const normalized = peaks.map((p) => {
          const val = (p / maxPeak) * 0.92;
          return Math.max(val, 0.06);
        });

        if (!isCancelled) {
          setDecodedPeaks(normalized);
        }
      } catch (err) {
        console.error("Audio decoding error:", err);
      } finally {
        if (audioCtx && audioCtx.state !== "closed") {
          try {
            await audioCtx.close();
          } catch {
            // Ignored
          }
        }
      }
    };

    decode();

    return () => {
      isCancelled = true;
      if (audioCtx && audioCtx.state !== "closed") {
        try {
          audioCtx.close();
        } catch {
          // Ignored
        }
      }
    };
  }, [audioBlob, isRecording]);

  // Core composite renderer: composites background, borders, flourishes, photo, soundwave, caption, and QR badge
  const renderArtFrame = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      liveDataArray: Uint8Array | null
    ) => {
      // 1. Background fill
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, width, height);

      // 2. Archival Mat Inset Frame Border
      const inset = Math.max(Math.min(width, height) * 0.038, 12);
      ctx.save();
      ctx.strokeStyle = palette.wave;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.3;
      ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
      ctx.restore();

      // 3. Decorative Style Variations (Decoupled from photo presence)
      if (decorativeStyle === "modern_border") {
        ctx.save();
        // Inner delicate hairline border
        const innerInset = inset + 6;
        ctx.strokeStyle = palette.wave;
        ctx.lineWidth = 0.6;
        ctx.globalAlpha = 0.25;
        ctx.strokeRect(innerInset, innerInset, width - innerInset * 2, height - innerInset * 2);

        // Minimal modern corner crosshairs
        ctx.lineWidth = 0.9;
        ctx.globalAlpha = 0.45;
        const ch = 10;
        ctx.beginPath();
        // Top-left
        ctx.moveTo(inset - 3, inset);
        ctx.lineTo(inset + ch, inset);
        ctx.moveTo(inset, inset - 3);
        ctx.lineTo(inset, inset + ch);
        // Top-right
        ctx.moveTo(width - inset + 3, inset);
        ctx.lineTo(width - inset - ch, inset);
        ctx.moveTo(width - inset, inset - 3);
        ctx.lineTo(width - inset, inset + ch);
        // Bottom-left
        ctx.moveTo(inset - 3, height - inset);
        ctx.lineTo(inset + ch, height - inset);
        ctx.moveTo(inset, height - inset + 3);
        ctx.lineTo(inset, height - inset - ch);
        // Bottom-right
        ctx.moveTo(width - inset + 3, height - inset);
        ctx.lineTo(width - inset - ch, height - inset);
        ctx.moveTo(width - inset, height - inset + 3);
        ctx.lineTo(width - inset, height - inset - ch);
        ctx.stroke();

        // Bauhaus geometric corner blocks
        const blockSize = 3;
        ctx.fillStyle = palette.wave;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(innerInset, innerInset, blockSize, blockSize);
        ctx.fillRect(width - innerInset - blockSize, innerInset, blockSize, blockSize);
        ctx.fillRect(innerInset, height - innerInset - blockSize, blockSize, blockSize);
        ctx.fillRect(width - innerInset - blockSize, height - innerInset - blockSize, blockSize, blockSize);
        ctx.restore();
      } else if (decorativeStyle === "botanical") {
        ctx.save();
        ctx.strokeStyle = palette.wave;
        ctx.fillStyle = palette.wave;
        ctx.lineWidth = 1.1;
        ctx.globalAlpha = 0.5;

        // Draw delicate botanical corner branch
        const drawBranch = (cx: number, cy: number, rot: number, scale: number) => {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rot);
          ctx.scale(scale, scale);

          // Curving stem
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(14, -6, 28, -5, 42, -15);
          ctx.stroke();

          // Leaf petals
          const leaves = [
            { x: 10, y: -3, angle: -0.6, rx: 6, ry: 3 },
            { x: 18, y: -5, angle: 0.5, rx: 7, ry: 3.5 },
            { x: 28, y: -7, angle: -0.65, rx: 6, ry: 3 },
            { x: 36, y: -11, angle: 0.45, rx: 5.5, ry: 2.8 },
            { x: 42, y: -15, angle: -0.2, rx: 4.5, ry: 2.2 },
          ];

          for (const lf of leaves) {
            ctx.save();
            ctx.translate(lf.x, lf.y);
            ctx.rotate(lf.angle);
            ctx.beginPath();
            ctx.ellipse(lf.rx, 0, lf.rx, lf.ry, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          ctx.restore();
        };

        const bScale = Math.min(width, height) * 0.0016;
        drawBranch(inset + 4, inset + 4, 0.35, bScale);
        drawBranch(width - inset - 4, inset + 4, Math.PI - 0.35, bScale);
        drawBranch(inset + 4, height - inset - 4, -0.35, bScale);
        drawBranch(width - inset - 4, height - inset - 4, Math.PI + 0.35, bScale);
        ctx.restore();
      } else if (decorativeStyle === "arch") {
        ctx.save();
        ctx.strokeStyle = palette.wave;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.28;
        const archTop = inset + 6;
        const archW = width * 0.62;
        const archLeft = (width - archW) / 2;
        const archH = height * 0.42;
        ctx.beginPath();
        ctx.moveTo(archLeft, archTop + archH);
        ctx.lineTo(archLeft, archTop + archW / 2);
        ctx.arc(archLeft + archW / 2, archTop + archW / 2, archW / 2, Math.PI, 0);
        ctx.lineTo(archLeft + archW, archTop + archH);
        ctx.stroke();

        // Keystone diamond at apex
        const apexX = archLeft + archW / 2;
        const apexY = archTop;
        ctx.fillStyle = palette.wave;
        ctx.beginPath();
        ctx.moveTo(apexX, apexY - 5);
        ctx.lineTo(apexX + 5, apexY);
        ctx.lineTo(apexX, apexY + 5);
        ctx.lineTo(apexX - 5, apexY);
        ctx.closePath();
        ctx.fill();

        // Base impost blocks
        ctx.fillRect(archLeft - 4, archTop + archH - 2, 8, 3);
        ctx.fillRect(archLeft + archW - 4, archTop + archH - 2, 8, 3);
        ctx.restore();
      } else if (decorativeStyle === "art_deco") {
        ctx.save();
        ctx.strokeStyle = palette.wave;
        ctx.fillStyle = palette.wave;
        ctx.lineWidth = 0.9;
        ctx.globalAlpha = 0.4;

        // Secondary inner pinstripe
        const decoInset = inset + 8;
        ctx.strokeRect(decoInset, decoInset, width - decoInset * 2, height - decoInset * 2);

        // Stepped chevron corner accents in all 4 corners
        const drawDecoCorner = (cx: number, cy: number, sx: number, sy: number) => {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(sx, sy);

          for (const step of [4, 9, 14]) {
            ctx.beginPath();
            ctx.moveTo(0, step + 12);
            ctx.lineTo(step, step + 12);
            ctx.lineTo(step, step);
            ctx.lineTo(step + 12, step);
            ctx.lineTo(step + 12, 0);
            ctx.stroke();
          }

          // Diamond stud at corner
          ctx.beginPath();
          ctx.moveTo(0, -3);
          ctx.lineTo(3, 0);
          ctx.lineTo(0, 3);
          ctx.lineTo(-3, 0);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        };

        drawDecoCorner(inset, inset, 1, 1);
        drawDecoCorner(width - inset, inset, -1, 1);
        drawDecoCorner(inset, height - inset, 1, -1);
        drawDecoCorner(width - inset, height - inset, -1, -1);
        ctx.restore();
      } else if (decorativeStyle === "vintage_grunge") {
        ctx.save();
        ctx.strokeStyle = palette.wave;
        ctx.fillStyle = palette.wave;

        // Faint concentric vinyl record microgrooves
        const centerX = width / 2;
        const centerY = height * 0.48;
        const maxR = Math.min(width, height) * 0.42;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.06;
        for (let r = maxR * 0.35; r <= maxR; r += maxR * 0.13) {
          ctx.beginPath();
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Offset deckle letterpress edge
        ctx.globalAlpha = 0.18;
        ctx.lineWidth = 0.7;
        ctx.strokeRect(inset + 2.5, inset + 2, width - inset * 2 - 5, height - inset * 2 - 4);

        // Retro studio inspection badge in bottom-left
        const stampW = 56;
        const stampH = 18;
        const stampX = inset + 8;
        const stampY = height - inset - stampH - 6;
        ctx.globalAlpha = 0.35;
        ctx.strokeRect(stampX, stampY, stampW, stampH);
        ctx.font = `600 6px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("HI-FI MASTER", stampX + stampW / 2, stampY + stampH / 2);
        ctx.restore();
      } else if (decorativeStyle === "luxury_marble") {
        ctx.save();
        ctx.strokeStyle = palette.wave;
        ctx.fillStyle = palette.wave;

        // Fine metallic dual hairlines
        const marbleInset = inset + 5;
        ctx.lineWidth = 0.7;
        ctx.globalAlpha = 0.25;
        ctx.strokeRect(marbleInset, marbleInset, width - marbleInset * 2, height - marbleInset * 2);

        // Subtle organic Carrara veining paths across background
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.08;
        ctx.beginPath();
        ctx.moveTo(inset * 2, height * 0.15);
        ctx.bezierCurveTo(width * 0.3, height * 0.28, width * 0.45, height * 0.12, width * 0.75, height * 0.35);
        ctx.bezierCurveTo(width * 0.85, height * 0.42, width * 0.7, height * 0.65, width - inset * 2, height * 0.72);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(width * 0.18, height * 0.68);
        ctx.bezierCurveTo(width * 0.35, height * 0.82, width * 0.6, height * 0.75, width * 0.82, height * 0.88);
        ctx.stroke();

        // Ornate 90-degree gilded corner brackets with terminal dots
        const drawBracket = (bx: number, by: number, sx: number, sy: number) => {
          ctx.save();
          ctx.translate(bx, by);
          ctx.scale(sx, sy);
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = 0.45;
          const blen = 16;
          ctx.beginPath();
          ctx.moveTo(0, blen);
          ctx.lineTo(0, 0);
          ctx.lineTo(blen, 0);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(blen, 0, 1.5, 0, Math.PI * 2);
          ctx.arc(0, blen, 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        };

        drawBracket(marbleInset, marbleInset, 1, 1);
        drawBracket(width - marbleInset, marbleInset, -1, 1);
        drawBracket(marbleInset, height - marbleInset, 1, -1);
        drawBracket(width - marbleInset, height - marbleInset, -1, -1);
        ctx.restore();
      } else if (decorativeStyle === "abstract_geometric") {
        ctx.save();
        ctx.strokeStyle = palette.wave;
        ctx.fillStyle = palette.wave;

        // Constructivist 45-degree diagonal intersecting accent ribbons
        ctx.lineWidth = 1.0;
        ctx.globalAlpha = 0.1;
        ctx.beginPath();
        ctx.moveTo(inset, height * 0.25);
        ctx.lineTo(width * 0.45, inset);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(width * 0.55, height - inset);
        ctx.lineTo(width - inset, height * 0.65);
        ctx.stroke();

        // Floating solid circular discs at optical balance points
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(width - inset - 22, inset + 22, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.arc(inset + 20, height * 0.72, 6, 0, Math.PI * 2);
        ctx.fill();

        // Intersecting balance axis lines
        ctx.globalAlpha = 0.22;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(inset + 14, height * 0.18);
        ctx.lineTo(inset + 14, height * 0.42);
        ctx.moveTo(width - inset - 14, height * 0.58);
        ctx.lineTo(width - inset - 14, height * 0.82);
        ctx.stroke();
        ctx.restore();
      } else if (decorativeStyle === "celestial") {
        ctx.save();
        ctx.strokeStyle = palette.wave;
        ctx.fillStyle = palette.wave;

        // Deterministic starlight field
        const starCoords = [
          { x: 0.12, y: 0.12, r: 1.2, a: 0.7, spike: true },
          { x: 0.22, y: 0.08, r: 0.8, a: 0.5, spike: false },
          { x: 0.35, y: 0.14, r: 0.6, a: 0.4, spike: false },
          { x: 0.82, y: 0.11, r: 1.4, a: 0.8, spike: true },
          { x: 0.88, y: 0.19, r: 0.7, a: 0.45, spike: false },
          { x: 0.15, y: 0.38, r: 0.9, a: 0.5, spike: false },
          { x: 0.09, y: 0.58, r: 1.1, a: 0.6, spike: true },
          { x: 0.14, y: 0.75, r: 0.7, a: 0.4, spike: false },
          { x: 0.86, y: 0.62, r: 0.8, a: 0.5, spike: false },
          { x: 0.91, y: 0.78, r: 1.3, a: 0.75, spike: true },
          { x: 0.48, y: 0.07, r: 0.7, a: 0.45, spike: false },
          { x: 0.68, y: 0.13, r: 0.9, a: 0.5, spike: false },
          { x: 0.78, y: 0.25, r: 0.6, a: 0.35, spike: false },
          { x: 0.28, y: 0.88, r: 0.8, a: 0.5, spike: false },
          { x: 0.72, y: 0.89, r: 0.7, a: 0.4, spike: false },
        ];

        // Draw constellation connector hairlines
        ctx.lineWidth = 0.6;
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.moveTo(width * 0.12, height * 0.12);
        ctx.lineTo(width * 0.22, height * 0.08);
        ctx.lineTo(width * 0.35, height * 0.14);
        ctx.moveTo(width * 0.68, height * 0.13);
        ctx.lineTo(width * 0.82, height * 0.11);
        ctx.lineTo(width * 0.88, height * 0.19);
        ctx.stroke();

        // Draw star points & diffraction spikes
        for (const s of starCoords) {
          const sx = width * s.x;
          const sy = height * s.y;
          ctx.globalAlpha = s.a;
          ctx.beginPath();
          ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
          ctx.fill();

          if (s.spike) {
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(sx - 4, sy);
            ctx.lineTo(sx + 4, sy);
            ctx.moveTo(sx, sy - 4);
            ctx.lineTo(sx, sy + 4);
            ctx.stroke();
          }
        }

        // Crescent lunar arc motif in top-right
        const moonX = width - inset - 28;
        const moonY = inset + 28;
        const moonR = 10;
        ctx.lineWidth = 1.0;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR, 0.4, Math.PI * 1.4);
        ctx.stroke();
        ctx.restore();
      }

      // 4. Photo & Soundwave Dimensions
      const hasPhoto = !!loadedImage;
      let waveMidY: number;
      let waveHeightMax: number;
      let waveWidthRatio: number;

      if (hasPhoto && loadedImage) {
        // Layout with personal photo in upper section
        const photoW = Math.min(width * 0.56, 380);
        const photoH = photoW * 0.90; // Natural balanced portrait ratio
        const photoX = (width - photoW) / 2;
        const photoY = height * 0.08 + Math.max(inset * 0.25, 4);

        // Clip and draw image with object-fit: cover math
        ctx.save();
        ctx.beginPath();
        if (decorativeStyle === "arch" || decorativeStyle === "luxury_marble") {
          const r = photoW / 2;
          ctx.moveTo(photoX, photoY + photoH);
          ctx.lineTo(photoX, photoY + r);
          ctx.arc(photoX + r, photoY + r, r, Math.PI, 0);
          ctx.lineTo(photoX + photoW, photoY + photoH);
          ctx.closePath();
        } else if (decorativeStyle === "modern_border" || decorativeStyle === "abstract_geometric") {
          ctx.rect(photoX, photoY, photoW, photoH);
        } else {
          const radius = 10;
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(photoX, photoY, photoW, photoH, radius);
          } else {
            ctx.rect(photoX, photoY, photoW, photoH);
          }
        }
        ctx.clip();

        // Calculate aspect ratio crop (no distortion)
        const imgAspect = loadedImage.width / loadedImage.height;
        const targetAspect = photoW / photoH;
        let sW = loadedImage.width;
        let sH = loadedImage.height;
        let sX = 0;
        let sY = 0;

        if (imgAspect > targetAspect) {
          sW = loadedImage.height * targetAspect;
          sX = (loadedImage.width - sW) / 2;
        } else {
          sH = loadedImage.width / targetAspect;
          sY = (loadedImage.height - sH) / 2;
        }

        ctx.drawImage(loadedImage, sX, sY, sW, sH, photoX, photoY, photoW, photoH);
        ctx.restore();

        // Delicate photo border
        ctx.save();
        ctx.strokeStyle = palette.wave;
        ctx.lineWidth = 1.0;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        if (decorativeStyle === "arch" || decorativeStyle === "luxury_marble") {
          const r = photoW / 2;
          ctx.moveTo(photoX, photoY + photoH);
          ctx.lineTo(photoX, photoY + r);
          ctx.arc(photoX + r, photoY + r, r, Math.PI, 0);
          ctx.lineTo(photoX + photoW, photoY + photoH);
          ctx.closePath();
        } else if (decorativeStyle === "modern_border" || decorativeStyle === "abstract_geometric") {
          ctx.rect(photoX, photoY, photoW, photoH);
        } else {
          const radius = 10;
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(photoX, photoY, photoW, photoH, radius);
          } else {
            ctx.rect(photoX, photoY, photoW, photoH);
          }
        }
        ctx.stroke();
        ctx.restore();

        // Position soundwave comfortably below photo
        waveMidY = photoY + photoH + (height - (photoY + photoH)) * 0.35;
        waveHeightMax = (height - (photoY + photoH)) * 0.40;
        waveWidthRatio = 0.76;
      } else {
        // Layout without photo: hero centered soundwave
        waveMidY = height * 0.48;
        waveHeightMax = height * 0.55;
        waveWidthRatio = 0.84;
      }

      // 5. Soundwave Rendering
      ctx.save();
      ctx.fillStyle = palette.wave;
      ctx.globalAlpha = 1.0;

      const bars = 80;
      const totalWaveWidth = width * waveWidthRatio;
      const barWidth = totalWaveWidth / bars;
      const gap = barWidth * 0.28;
      const effectiveBarWidth = Math.max(barWidth - gap, 2);
      const startX = (width - totalWaveWidth) / 2;

      for (let i = 0; i < bars; i++) {
        let amp = 0.08;
        if (liveDataArray) {
          const step = Math.floor(liveDataArray.length / bars);
          const sample = liveDataArray[i * step] / 128.0 - 1.0;
          amp = Math.min(Math.max(Math.abs(sample) * elevationScale * 1.8, 0.04), 0.95);
        } else if (decodedPeaks && decodedPeaks.length > 0) {
          const peakIdx = Math.floor((i / bars) * decodedPeaks.length);
          const peakVal = decodedPeaks[peakIdx] || 0.08;
          amp = Math.min(Math.max(peakVal * elevationScale, 0.05), 1.0);
        } else {
          // Elegant harmonic idle wave curve
          const t = i / bars;
          const envelope = Math.sin(t * Math.PI);
          const oscillation =
            0.4 * Math.sin(t * 12 * Math.PI) +
            0.3 * Math.sin(t * 22 * Math.PI) +
            0.2 * Math.sin(t * 40 * Math.PI);
          amp = Math.max(Math.abs(oscillation) * envelope * 0.9 * elevationScale, 0.08);
        }

        const barHeight = Math.max(amp * waveHeightMax, 4);
        const x = startX + i * barWidth;
        const y = waveMidY - barHeight / 2;

        ctx.beginPath();
        const radius = Math.min(effectiveBarWidth / 2, barHeight / 2);
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(x, y, effectiveBarWidth, barHeight, radius);
        } else {
          ctx.rect(x, y, effectiveBarWidth, barHeight);
        }
        ctx.fill();
      }
      ctx.restore();

      // 6. Custom Inscription Caption
      if (caption && caption.trim().length > 0) {
        ctx.save();
        ctx.fillStyle = palette.wave;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const captionY = hasPhoto
          ? waveMidY + waveHeightMax * 0.55 + (height - (waveMidY + waveHeightMax * 0.55)) * 0.35
          : height * 0.84;

        const fontSize = Math.max(Math.min(width * 0.036, 20), 12);
        ctx.font = `italic 500 ${fontSize}px var(--font-serif), "Cormorant Garamond", Georgia, serif`;
        ctx.fillText(caption.trim(), width / 2, Math.min(captionY, height - inset - 14));
        ctx.restore();
      }

      // 7. Subtle Scannable QR Code Badge in Bottom Right
      ctx.save();
      const qrSize = Math.max(Math.min(width, height) * 0.055, 22);
      const qrX = width - inset - qrSize - 4;
      const qrY = height - inset - qrSize - 4;

      ctx.strokeStyle = palette.wave;
      ctx.fillStyle = palette.wave;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.4;

      ctx.strokeRect(qrX, qrY, qrSize, qrSize);
      ctx.font = `bold ${Math.max(qrSize * 0.35, 7)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("QR", qrX + qrSize / 2, qrY + qrSize / 2);
      ctx.restore();
    },
    [palette, decorativeStyle, loadedImage, decodedPeaks, elevationScale, caption]
  );

  // Main Canvas Rendering Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 500;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    let running = true;

    if (isRecording && analyserNode) {
      // MODE 1: LIVE MICROPHONE RECORDING AT 60 FPS
      const bufferLength = analyserNode.fftSize;
      const dataArray = new Uint8Array(bufferLength);

      const renderLive = () => {
        if (!running) return;
        analyserNode.getByteTimeDomainData(dataArray);

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);
        renderArtFrame(ctx, width, height, dataArray);
        ctx.restore();

        animationFrameRef.current = requestAnimationFrame(renderLive);
      };

      renderLive();
    } else {
      // MODE 2: STATIC DECODED PEAKS OR PREVIEW
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);
      renderArtFrame(ctx, width, height, null);
      ctx.restore();
    }

    return () => {
      running = false;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isRecording, analyserNode, renderArtFrame]);

  return (
    <div className={`relative w-full h-full flex flex-col items-center justify-center ${className}`}>
      <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ backgroundColor: palette.bg }}
        />
        {isRecording && (
          <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1 bg-red-950/80 border border-red-500/50 rounded-full text-xs font-semibold text-red-300 animate-pulse shadow-md">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            LIVE RECORDING
          </div>
        )}
      </div>
    </div>
  );
}

