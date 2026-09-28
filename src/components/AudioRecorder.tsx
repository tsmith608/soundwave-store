"use client";

import React, { useState, useRef, useEffect } from "react";

interface AudioRecorderProps {
  onAudioReady: (blob: Blob, file?: File) => void;
  onAnalyserReady?: (analyser: AnalyserNode | null) => void;
  onRecordingChange?: (isRecording: boolean) => void;
}

export default function AudioRecorder({
  onAudioReady,
  onAnalyserReady,
  onRecordingChange,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up all streams, contexts, and intervals on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        try {
          audioContextRef.current.close();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  const startRecording = async () => {
    setErrorMsg(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMsg("Audio recording is not supported in this browser environment. Please upload an audio file instead.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // Web Audio API Context & AnalyserNode configuration
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      if (onAnalyserReady) {
        onAnalyserReady(analyser);
      }

      // Initialize MediaRecorder
      const options = { mimeType: "audio/webm;codecs=opus" };
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, options);
      } catch {
        mediaRecorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mime = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        onAudioReady(blob);
        setSelectedFileName(`Recorded Voice Note (${recordSeconds}s)`);

        // Disconnect audio nodes and stop tracks
        stream.getTracks().forEach((track) => track.stop());
        if (audioCtx && audioCtx.state !== "closed") {
          try {
            audioCtx.close();
          } catch {
            // Context closed
          }
        }
        if (onAnalyserReady) {
          onAnalyserReady(null);
        }
      };

      mediaRecorder.start(200); // 200ms slice interval
      setIsRecording(true);
      if (onRecordingChange) onRecordingChange(true);
      setRecordSeconds(0);

      // Increment recording counter
      const startTime = Date.now();
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordSeconds(elapsed);
        if (elapsed >= 60) {
          // Maximum 60 seconds
          stopRecording();
        }
      }, 500);
    } catch (err: any) {
      console.error("Microphone access error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setErrorMsg("Microphone permission was denied. Please allow microphone access or upload an audio file instead.");
      } else {
        setErrorMsg("Unable to access microphone: " + (err.message || "Unknown error"));
      }
      setIsRecording(false);
      if (onRecordingChange) onRecordingChange(false);
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (onRecordingChange) onRecordingChange(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const name = file.name.toLowerCase();
    const isVideo = file.type.startsWith("video/") || [".mp4", ".mov"].some((ext) => name.endsWith(ext));
    const validExtensions = [".mp3", ".wav", ".webm", ".m4a", ".aac", ".ogg"];
    const isValidExt = validExtensions.some((ext) => name.endsWith(ext));

    if (!isValidExt && !isVideo && !file.type.startsWith("audio/")) {
      setErrorMsg("Unsupported file. Upload an audio file (MP3, M4A, WAV) or a phone video (MP4, MOV).");
      return;
    }

    // Audio files go to the server as-is (50MB cap). Videos are decoded in the
    // browser and only their sound is uploaded, so they may be larger.
    const limit = isVideo ? 400 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > limit) {
      setErrorMsg(isVideo ? "That video is over 400MB — trim it to the moment you want first." : "Audio file exceeds maximum allowed size of 50MB.");
      return;
    }

    setSelectedFileName(file.name);
    onAudioReady(file, file);
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {!isRecording ? (
          <button
            type="button"
            onClick={startRecording}
            className="flex-1 min-w-[170px] flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-[#2D2A26] hover:bg-[#000000] text-white font-semibold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
            Record a Voice or Sound
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="flex-1 min-w-[170px] flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold shadow-lg animate-pulse"
          >
            <span className="w-3.5 h-3.5 rounded-sm bg-white"></span>
            Stop Recording ({recordSeconds}s)
          </button>
        )}

        <label className="flex-1 min-w-[150px] flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#FAF7F2] hover:bg-white border border-[#D8C7B5] hover:border-[#2D2A26] text-[#2D2A26] font-medium cursor-pointer transition-all">
          <svg className="w-5 h-5 text-[#2D2A26]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span>Upload Audio</span>
          <input
            type="file"
            accept="audio/*,video/mp4,video/quicktime,.mp3,.wav,.webm,.m4a,.mp4,.mov,.aac"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {isRecording && (
        <div className="w-full bg-red-950/40 border border-red-800/40 rounded-lg p-3 flex items-center justify-between text-xs text-red-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            <span>Recording live audio... Speak, sing, or play your audio</span>
          </div>
          <span className="font-mono font-bold">{recordSeconds} / 60s</span>
        </div>
      )}

      {selectedFileName && !isRecording && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-800/30 px-3 py-2 rounded-lg">
          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="truncate">Loaded: {selectedFileName}</span>
        </div>
      )}

      {errorMsg && (
        <div className="text-xs text-amber-300 bg-amber-950/40 border border-amber-800/40 px-3 py-2.5 rounded-lg flex items-start gap-2">
          <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
