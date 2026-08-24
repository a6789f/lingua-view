// Client-side audio extraction: decode a video file's audio track and
// encode it as a small 16 kHz mono WAV so only the audio (never the video)
// is sent to the AI provider.

const TARGET_RATE = 16000;

export async function extractWavFromVideo(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtx: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await ctx.close().catch(() => {});
  }
  const mono = downmixAndResample(decoded, TARGET_RATE);
  return encodeWav(mono, TARGET_RATE);
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
