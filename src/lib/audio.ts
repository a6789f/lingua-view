// Client-side audio extraction: decode a video file's audio track and
// encode it as small 16 kHz mono WAV chunks so only the audio (never the
// video) is sent to the server-side transcription function.

const TARGET_RATE = 16000;

/** Hard MVP limits — long movies are out of scope for this prototype. */
export const MAX_FILE_BYTES = 400 * 1024 * 1024;
export const MAX_DURATION_SEC = 10 * 60;
export const RECOMMENDED_DURATION_SEC = 5 * 60;
/** Chunk length sent per transcription request (keeps each request small/fast). */
export const CHUNK_SECONDS = 60;

export interface AudioChunk {
  blob: Blob;
  /** Offset of this chunk from the start of the video, in seconds. */
  offset: number;
  duration: number;
}

export class AudioExtractionError extends Error {}

async function decode(file: File): Promise<AudioBuffer> {
  const AudioCtx: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) throw new AudioExtractionError("This browser cannot extract audio from video files.");
  const ctx = new AudioCtx();
  try {
    const arrayBuffer = await file.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } catch (e) {
    throw new AudioExtractionError(
      `Audio extraction failed — this video's audio track could not be decoded in the browser (${
        e instanceof Error ? e.message : "unknown decode error"
      }). Try an MP4/WebM file with a standard AAC or Opus audio track.`,
    );
  } finally {
    await ctx.close().catch(() => {});
  }
}

/** Extract the full audio track as sequential 16 kHz mono WAV chunks. */
export async function extractWavChunks(file: File, chunkSeconds = CHUNK_SECONDS): Promise<AudioChunk[]> {
  const decoded = await decode(file);
  if (decoded.duration > MAX_DURATION_SEC) {
    throw new AudioExtractionError(
      `This video is ${Math.round(decoded.duration / 60)} minutes long. This prototype supports up to ${
        MAX_DURATION_SEC / 60
      } minutes — please trim it first.`,
    );
  }
  const mono = downmixAndResample(decoded, TARGET_RATE);
  if (mono.length < TARGET_RATE * 0.5) {
    throw new AudioExtractionError("No audio track was found in this video.");
  }

  const chunks: AudioChunk[] = [];
  const per = Math.floor(chunkSeconds * TARGET_RATE);
  for (let start = 0; start < mono.length; start += per) {
    const slice = mono.subarray(start, Math.min(start + per, mono.length));
    chunks.push({
      blob: encodeWav(slice, TARGET_RATE),
      offset: start / TARGET_RATE,
      duration: slice.length / TARGET_RATE,
    });
  }
  return chunks;
}

/** Back-compat single-blob extraction. */
export async function extractWavFromVideo(file: File): Promise<Blob> {
  const decoded = await decode(file);
  return encodeWav(downmixAndResample(decoded, TARGET_RATE), TARGET_RATE);
}

function downmixAndResample(buffer: AudioBuffer, rate: number): Float32Array {
  const channels = buffer.numberOfChannels;
  const ratio = buffer.sampleRate / rate;
  const outLength = Math.floor(buffer.length / ratio);
  const out = new Float32Array(outLength);
  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c));

  for (let i = 0; i < outLength; i++) {
    const srcIndex = Math.floor(i * ratio);
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += data[c]?.[srcIndex] ?? 0;
    out[i] = sum / channels;
  }
  return out;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}
