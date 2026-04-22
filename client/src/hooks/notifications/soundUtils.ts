export type NotificationSound = "beep" | "chime";

const SAMPLE_RATE = 44100;

interface ToneOptions {
  frequency: number;
  durationMs: number;
  volume: number;
  startMs?: number;
}

function generateTone(options: ToneOptions): Float32Array {
  const { frequency, durationMs, volume, startMs = 0 } = options;
  const totalSamples = Math.ceil(((startMs + durationMs) / 1000) * SAMPLE_RATE);
  const startSample = Math.floor((startMs / 1000) * SAMPLE_RATE);
  const samples = new Float32Array(totalSamples);

  for (let i = startSample; i < totalSamples; i++) {
    const t = (i - startSample) / SAMPLE_RATE;
    const envelope = Math.exp(-t * (1000 / durationMs) * 3);
    samples[i] = Math.sin(2 * Math.PI * frequency * t) * volume * envelope;
  }

  return samples;
}

function mixSamples(tracks: Float32Array[]): Float32Array {
  const maxLength = tracks.reduce((max, track) => Math.max(max, track.length), 0);
  const mixed = new Float32Array(maxLength);

  tracks.forEach((track) => {
    for (let i = 0; i < track.length; i++) {
      mixed[i] += track[i];
    }
  });

  // Clamp to [-1, 1]
  for (let i = 0; i < mixed.length; i++) {
    mixed[i] = Math.max(-1, Math.min(1, mixed[i]));
  }

  return mixed;
}

function samplesToWavUrl(samples: Float32Array): string {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // WAV header
  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // subchunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, numSamples * 2, true);

  // Convert float samples to 16-bit PCM
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped * 0x7fff, true);
  }

  const blob = new Blob([buffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

const SOUNDS: Record<NotificationSound, () => string> = {
  beep: () => {
    const samples = generateTone({ frequency: 880, durationMs: 150, volume: 0.3 });
    return samplesToWavUrl(samples);
  },
  chime: () => {
    const samples = mixSamples([
      generateTone({ frequency: 587, durationMs: 200, volume: 0.25 }),
      generateTone({ frequency: 784, durationMs: 250, volume: 0.25, startMs: 120 }),
    ]);
    return samplesToWavUrl(samples);
  },
};

const urlCache = new Map<NotificationSound, string>();

function getSoundUrl(sound: NotificationSound): string {
  const cached = urlCache.get(sound);
  if (cached) return cached;

  const url = SOUNDS[sound]();
  urlCache.set(sound, url);
  return url;
}

export function playNotificationSound(sound: NotificationSound): void {
  try {
    const audio = new Audio(getSoundUrl(sound));
    audio.play().catch(() => {});
  } catch {
    // Audio playback not available: no-op
  }
}
