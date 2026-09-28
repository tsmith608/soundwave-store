import path from "path";

export interface AudioValidationResult {
  valid: boolean;
  format?: "wav" | "mp3" | "webm" | "m4a";
  extension?: string;
  error?: string;
  durationSeconds?: number;
}

export const ALLOWED_EXTENSIONS = [".wav", ".mp3", ".webm", ".m4a"];
export const ALLOWED_MIME_TYPES = [
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/webm",
  "video/webm", // MediaRecorder in Chrome often produces video/webm for audio blobs
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
];

export const MAX_AUDIO_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Validate MPEG audio frame header (ISO/IEC 11172-3 / 13818-3).
 * Verifies sync bits, version, layer, bitrate, sampling rate, and emphasis.
 */
export function isValidMpegFrameHeader(buffer: Buffer, offset: number): boolean {
  if (offset + 4 > buffer.length) return false;
  const b0 = buffer[offset];
  const b1 = buffer[offset + 1];
  const b2 = buffer[offset + 2];
  const b3 = buffer[offset + 3];

  // 11 sync bits: 0xFF followed by top 3 bits = 111 (0xE0)
  if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return false;

  // MPEG Version: 00 = 2.5, 10 = 2, 11 = 1. (01 is reserved)
  const version = (b1 >> 3) & 0x03;
  if (version === 0x01) return false;

  // MPEG Layer: 01 = Layer III, 10 = Layer II, 11 = Layer I. (00 is reserved)
  // Crucial: Eliminates JPEG JFIF 0xFF 0xE0 false positives where layer bits are 00!
  const layer = (b1 >> 1) & 0x03;
  if (layer === 0x00) return false;

  // Bitrate index: 1111 (0x0F) is bad/reserved, 0000 is free (disallowed)
  const bitrateIdx = (b2 >> 4) & 0x0f;
  if (bitrateIdx === 0x0f || bitrateIdx === 0x00) return false;

  // Sampling rate frequency index: 11 (0x03) is reserved
  const sampleRateIdx = (b2 >> 2) & 0x03;
  if (sampleRateIdx === 0x03) return false;

  // Emphasis: 10 (0x02) is reserved
  const emphasis = b3 & 0x03;
  if (emphasis === 0x02) return false;

  return true;
}

/**
 * RIFF WAV structure inspection result.
 */
export interface WavInfo {
  valid: boolean;
  sampleRate: number;
  byteRate: number;
  channels: number;
  bitsPerSample: number;
  dataSize: number;
  error?: string;
}

/**
 * Parse RIFF WAV container chunks with strict boundary and validity checks.
 * Prevents RangeError exceptions and rejects corrupted containers.
 */
export function parseWavHeader(buffer: Buffer): WavInfo {
  if (buffer.length < 44) {
    return {
      valid: false,
      sampleRate: 0,
      byteRate: 0,
      channels: 0,
      bitsPerSample: 0,
      dataSize: 0,
      error: "WAV file truncated: smaller than minimal header size (44 bytes)",
    };
  }

  if (
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WAVE"
  ) {
    return {
      valid: false,
      sampleRate: 0,
      byteRate: 0,
      channels: 0,
      bitsPerSample: 0,
      dataSize: 0,
      error: "Not a valid RIFF/WAVE file container",
    };
  }

  let offset = 12;
  let hasFmt = false;
  let hasData = false;
  let sampleRate = 0;
  let byteRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === "fmt ") {
      // Standard PCM fmt chunk requires at least 16 bytes of payload
      if (chunkSize < 16 || offset + 8 + 16 > buffer.length) {
        return {
          valid: false,
          sampleRate: 0,
          byteRate: 0,
          channels: 0,
          bitsPerSample: 0,
          dataSize: 0,
          error: "Truncated or out-of-bounds fmt chunk",
        };
      }
      channels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      byteRate = buffer.readUInt32LE(offset + 16);
      bitsPerSample = buffer.readUInt16LE(offset + 22);
      hasFmt = true;
    } else if (chunkId === "data") {
      hasData = true;
      dataSize = chunkSize;
    }

    // RIFF chunk sizes are word-aligned (padded to even 2-byte boundary)
    const paddedSize = chunkSize + (chunkSize % 2);
    offset += 8 + paddedSize;

    // Safety guard against integer overflow
    if (offset < 0) break;
  }

  if (!hasFmt) {
    return {
      valid: false,
      sampleRate: 0,
      byteRate: 0,
      channels: 0,
      bitsPerSample: 0,
      dataSize: 0,
      error: "WAV container missing fmt chunk",
    };
  }

  if (!hasData) {
    return {
      valid: false,
      sampleRate: 0,
      byteRate: 0,
      channels: 0,
      bitsPerSample: 0,
      dataSize: 0,
      error: "WAV container missing data chunk",
    };
  }

  if (sampleRate <= 0 || byteRate <= 0 || channels <= 0) {
    return {
      valid: false,
      sampleRate,
      byteRate,
      channels,
      bitsPerSample,
      dataSize,
      error: "WAV contains invalid audio parameters (sampleRate or byteRate <= 0)",
    };
  }

  return {
    valid: true,
    sampleRate,
    byteRate,
    channels,
    bitsPerSample,
    dataSize,
  };
}

/**
 * Inspect magic bytes of audio buffer to determine exact audio format.
 */
export function detectAudioFormat(buffer: Buffer): "wav" | "mp3" | "webm" | "m4a" | null {
  if (buffer.length < 12) return null;

  // Immediate rejection of known non-audio formats that might contain false-positive bit sequences
  // JPEG SOI marker: 0xFF 0xD8
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return null;
  // PNG signature: 0x89 0x50 0x4E 0x47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return null;
  // PDF signature: %PDF
  if (buffer.toString("ascii", 0, 4) === "%PDF") return null;
  // GIF signature: GIF8
  if (buffer.toString("ascii", 0, 4) === "GIF8") return null;

  // 1. WAV check: Starts with 'RIFF', bytes 8..12 are 'WAVE', requires >= 44 bytes and valid WAV structure
  if (
    buffer.length >= 44 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WAVE"
  ) {
    const wavInfo = parseWavHeader(buffer);
    if (wavInfo.valid) {
      return "wav";
    }
  }

  // 2. MP3 check:
  // Case 2a: Has ID3v2 container header
  if (buffer.length >= 10 && buffer.toString("ascii", 0, 3) === "ID3") {
    const tagSize =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);
    const audioStart = 10 + tagSize;
    // Must have at least 4 bytes of audio data after ID3 tag
    if (buffer.length >= audioStart + 4) {
      // Verify there is a valid MPEG frame header in the audio stream
      const searchEnd = Math.min(buffer.length - 4, audioStart + 1024);
      for (let i = audioStart; i <= searchEnd; i++) {
        if (isValidMpegFrameHeader(buffer, i)) {
          return "mp3";
        }
      }
    }
  } else {
    // Case 2b: Raw MP3 stream without ID3 header
    // Raw MPEG streams start at offset 0, or must have consecutive valid frames
    if (isValidMpegFrameHeader(buffer, 0)) {
      return "mp3";
    }
    // If not starting at 0, require consecutive frame sync to avoid noise false positives
    const searchLimit = Math.min(buffer.length - 4, 128);
    for (let i = 0; i <= searchLimit; i++) {
      if (isValidMpegFrameHeader(buffer, i)) {
        const nextSync = buffer.indexOf(0xff, i + 4);
        if (nextSync !== -1 && isValidMpegFrameHeader(buffer, nextSync)) {
          return "mp3";
        }
      }
    }
  }

  // 3. WebM check: Starts with EBML Header 0x1A 0x45 0xDF 0xA3
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return "webm";
  }

  // 4. M4A / MP4 check: bytes 4..8 are 'ftyp'
  if (buffer.toString("ascii", 4, 8) === "ftyp") {
    return "m4a";
  }

  return null;
}

/**
 * Estimate or accurately parse audio duration in seconds from buffer.
 */
export function estimateAudioDuration(buffer: Buffer, format: "wav" | "mp3" | "webm" | "m4a"): number {
  try {
    if (format === "wav") {
      const wavInfo = parseWavHeader(buffer);
      if (wavInfo.valid && wavInfo.byteRate > 0 && wavInfo.dataSize > 0) {
        return Math.round((wavInfo.dataSize / wavInfo.byteRate) * 10) / 10;
      }
      return 0;
    }

    if (format === "mp3") {
      let dataOffset = 0;
      if (buffer.length >= 10 && buffer.toString("ascii", 0, 3) === "ID3") {
        const tagSize =
          ((buffer[6] & 0x7f) << 21) |
          ((buffer[7] & 0x7f) << 14) |
          ((buffer[8] & 0x7f) << 7) |
          (buffer[9] & 0x7f);
        dataOffset = 10 + tagSize;
      }

      const audioBytes = Math.max(0, buffer.length - dataOffset);
      if (audioBytes === 0) return 0;
      const estSeconds = audioBytes / 16000;
      return Math.round(estSeconds * 10) / 10;
    }

    if (format === "webm") {
      const estSeconds = buffer.length / 16000;
      return Math.round(estSeconds * 10) / 10;
    }

    if (format === "m4a") {
      const estSeconds = buffer.length / 16000;
      return Math.round(estSeconds * 10) / 10;
    }
  } catch (err) {
    console.warn("Failed to parse precise duration:", err);
  }

  return Math.max(0, Math.round((buffer.length / 16000) * 10) / 10);
}

/**
 * Validate audio upload buffer, filename, and mime type strictly.
 */
export function validateAudioUpload(
  buffer: Buffer,
  originalFilename?: string,
  mimeType?: string
): AudioValidationResult {
  // 1. Check size boundaries
  if (buffer.length === 0) {
    return { valid: false, error: "Empty audio file received" };
  }

  if (buffer.length > MAX_AUDIO_FILE_SIZE) {
    return {
      valid: false,
      error: `Audio file exceeds maximum size limit of ${MAX_AUDIO_FILE_SIZE / (1024 * 1024)}MB`,
    };
  }

  if (buffer.length < 12) {
    return {
      valid: false,
      error: "Audio file too small or corrupted (< 12 bytes)",
    };
  }

  // 2. Validate client-supplied metadata as strict restrictions (never fallbacks)
  if (originalFilename) {
    const ext = path.extname(originalFilename).toLowerCase();
    if (ext && !ALLOWED_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        error: `Unsupported file extension: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
      };
    }
  }

  if (mimeType) {
    const lowerMime = mimeType.toLowerCase().split(";")[0].trim();
    if (!ALLOWED_MIME_TYPES.includes(lowerMime) && lowerMime !== "application/octet-stream") {
      return {
        valid: false,
        error: `Unsupported audio MIME type: ${mimeType}`,
      };
    }
  }

  // 3. Mandatory magic byte detection (NO client fallback)
  const detected = detectAudioFormat(buffer);
  if (!detected) {
    return {
      valid: false,
      error: "Unsupported or corrupted audio format. Allowed formats: MP3, WAV, WebM, M4A",
    };
  }

  // 4. Container-specific validation
  if (detected === "wav") {
    const wavInfo = parseWavHeader(buffer);
    if (!wavInfo.valid) {
      return {
        valid: false,
        error: wavInfo.error || "Corrupted or incomplete WAV audio file",
      };
    }
  }

  const duration = estimateAudioDuration(buffer, detected);

  return {
    valid: true,
    format: detected,
    extension: `.${detected}`,
    durationSeconds: duration,
  };
}
