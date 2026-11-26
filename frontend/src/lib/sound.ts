/**
 * Web Audio API sound engine: telecom effects and the "Haunted 2G Synthwave" loop.
 * Everything is synthesised in real time, so no audio file is downloaded.
 */

const DTMF_FREQS: Record<string, [number, number]> = {
  "1": [697, 1209],
  "2": [697, 1336],
  "3": [697, 1477],
  "4": [770, 1209],
  "5": [770, 1336],
  "6": [770, 1477],
  "7": [852, 1209],
  "8": [852, 1336],
  "9": [852, 1477],
  "*": [941, 1209],
  "0": [941, 1336],
  "#": [941, 1477],
};

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  // Autoplay policy: stay silent until the visitor has clicked, tapped or typed once.
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (!sharedCtx && activation && !activation.hasBeenActive) return null;
  if (!sharedCtx) sharedCtx = new Ctor();
  if (sharedCtx.state === "suspended") void sharedCtx.resume();
  return sharedCtx;
}

const midiToHz = (note: number) => 440 * 2 ** ((note - 69) / 12);

function envelope(ctx: AudioContext, start: number, peak: number, attack: number, release: number, destination: AudioNode) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + release);
  gain.connect(destination);
  return gain;
}

// ------------------------------------------------------------------------------------ telecom SFX

/** ITU-T dual-tone keypad beep with a faint spectral echo. Ducks the music so beeps stay crisp. */
export function playDtmf(key: string, enabled = true): void {
  if (!enabled) return;
  const pair = DTMF_FREQS[key];
  const ctx = getAudioContext();
  if (!pair || !ctx) return;
  duckMusic();
  const now = ctx.currentTime;
  for (const [delay, level] of [[0, 0.06], [0.12, 0.012]] as const) {
    const gain = envelope(ctx, now + delay, level, 0.004, 0.085, ctx.destination);
    for (const freq of pair) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + delay);
      osc.connect(gain);
      osc.start(now + delay);
      osc.stop(now + delay + 0.1);
    }
  }
}

/** 2G radio handshake arpeggio followed by a little bat flutter. */
export function playHandshake(enabled = true): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [1046.5, 1318.5, 1567.98].forEach((freq, idx) => {
    const start = now + idx * 0.042;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, start);
    osc.connect(envelope(ctx, start, 0.045, 0.004, 0.04, ctx.destination));
    osc.start(start);
    osc.stop(start + 0.05);
  });
  playBatFlutter(enabled, 0.16);
}

let noiseBuffer: AudioBuffer | null = null;

/** Wing-beat burst: band-passed noise chopped by a fast square LFO. */
export function playBatFlutter(enabled = true, delay = 0): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
  }
  const start = ctx.currentTime + delay;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(1500, start);
  band.frequency.exponentialRampToValueAtTime(3200, start + 0.35);
  band.Q.value = 2.5;
  const flap = ctx.createGain();
  flap.gain.value = 0;
  const lfo = ctx.createOscillator();
  lfo.type = "square";
  lfo.frequency.value = 19;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.5;
  lfo.connect(lfoDepth).connect(flap.gain);
  source.connect(band).connect(flap).connect(envelope(ctx, start, 0.05, 0.02, 0.33, ctx.destination));
  source.start(start);
  lfo.start(start);
  source.stop(start + 0.4);
  lfo.stop(start + 0.4);
}

/** Short dissonant haunted-organ chord for counterfeit or tampered results. */
export function playPoltergeistAlert(enabled = true): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  duckMusic(0.9);
  const now = ctx.currentTime;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2400, now);
  filter.frequency.exponentialRampToValueAtTime(500, now + 0.9);
  const out = envelope(ctx, now, 0.05, 0.03, 0.85, ctx.destination);
  const tremolo = ctx.createGain();
  tremolo.gain.value = 0.75;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 7;
  const depth = ctx.createGain();
  depth.gain.value = 0.25;
  lfo.connect(depth).connect(tremolo.gain);
  filter.connect(tremolo).connect(out);
  for (const note of [50, 56, 61, 67]) { // D3, Ab3 (tritone), C#4, G4
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(midiToHz(note), now);
    osc.detune.setValueAtTime(note % 2 ? 9 : -9, now);
    osc.connect(filter);
    osc.start(now);
    osc.stop(now + 0.95);
  }
  lfo.start(now);
  lfo.stop(now + 0.95);
}

// ------------------------------------------------------------------- Haunted 2G Synthwave loop

const BPM = 114;
const EIGHTH = 60 / BPM / 2;
const MUSIC_LEVEL = 0.035;
const DUCK_LEVEL = 0.015;

// D harmonic minor (D E F G A Bb C#), one bar = 8 eighth notes.
const ARP = [62, 65, 69, 70, 69, 65, 61, 64]; // D4 F4 A4 Bb4 A4 F4 C#4 E4
const BASS = [38, 34, 31, 33]; // D2 Bb1 G1 A1, one root per bar
const LEAD: Array<[number, number]> = [ // [midi note, length in eighths], 4 bars = 32 eighths
  [69, 4], [65, 4], [70, 4], [74, 4], [67, 4], [70, 4], [69, 6], [73, 2],
];

let musicBus: GainNode | null = null;
let schedulerTimer: number | null = null;
let nextStepTime = 0;
let step = 0;

function scheduleStep(ctx: AudioContext, bus: GainNode, index: number, time: number) {
  const bar = Math.floor(index / 8) % BASS.length;
  const inBar = index % 8;

  // Track 1: spooky harpsichord arpeggio (bright square through a closing low-pass).
  const arp = ctx.createOscillator();
  arp.type = "square";
  arp.frequency.setValueAtTime(midiToHz(ARP[inBar] ?? 62), time);
  const pluck = ctx.createBiquadFilter();
  pluck.type = "lowpass";
  pluck.frequency.setValueAtTime(3200, time);
  pluck.frequency.exponentialRampToValueAtTime(700, time + 0.18);
  arp.connect(pluck).connect(envelope(ctx, time, 0.32, 0.003, 0.2, bus));
  arp.start(time);
  arp.stop(time + 0.24);

  // Track 2: round sub-bass on beats 1, the "and" of 2, and 3 for a bouncy groove.
  if (inBar === 0 || inBar === 3 || inBar === 4) {
    const root = BASS[bar] ?? 38;
    for (const [type, level] of [["triangle", 0.8], ["sine", 0.6]] as const) {
      const bass = ctx.createOscillator();
      bass.type = type;
      bass.frequency.setValueAtTime(midiToHz(root), time);
      bass.connect(envelope(ctx, time, level, 0.01, EIGHTH * 1.6, bus));
      bass.start(time);
      bass.stop(time + EIGHTH * 1.8);
    }
  }

  // Track 3: ghost theremin lead, a sine with a 5.5 Hz vibrato gliding above the groove.
  let cursor = 0;
  for (const [note, length] of LEAD) {
    if (cursor === index % 32) {
      const duration = length * EIGHTH;
      const lead = ctx.createOscillator();
      lead.type = "sine";
      lead.frequency.setValueAtTime(midiToHz(note), time);
      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = 5.5;
      const depth = ctx.createGain();
      depth.gain.value = midiToHz(note) * 0.012;
      vibrato.connect(depth).connect(lead.frequency);
      lead.connect(envelope(ctx, time, 0.42, duration * 0.3, duration * 0.75, bus));
      lead.start(time);
      vibrato.start(time);
      lead.stop(time + duration * 1.1);
      vibrato.stop(time + duration * 1.1);
    }
    cursor += length;
  }
}

/** Starts the loop. Must be called from a user gesture (browser autoplay rules). */
export function startSpookyMusic(): void {
  const ctx = getAudioContext();
  if (!ctx || schedulerTimer !== null) return;
  musicBus = ctx.createGain();
  musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
  musicBus.gain.exponentialRampToValueAtTime(MUSIC_LEVEL, ctx.currentTime + 1.2);
  musicBus.connect(ctx.destination);
  nextStepTime = ctx.currentTime + 0.1;
  step = 0;
  const bus = musicBus;
  // Look-ahead scheduler: a coarse JS timer queues sample-accurate Web Audio events 150 ms ahead.
  schedulerTimer = window.setInterval(() => {
    while (nextStepTime < ctx.currentTime + 0.15) {
      scheduleStep(ctx, bus, step, nextStepTime);
      nextStepTime += EIGHTH;
      step = (step + 1) % 32;
    }
  }, 40);
}

export function stopSpookyMusic(): void {
  const ctx = getAudioContext();
  if (schedulerTimer !== null) window.clearInterval(schedulerTimer);
  schedulerTimer = null;
  if (ctx && musicBus) {
    const bus = musicBus;
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0001), ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    window.setTimeout(() => bus.disconnect(), 500);
  }
  musicBus = null;
}

export const isMusicPlaying = () => schedulerTimer !== null;

/** Lowers the music for a moment so keypad tones and alerts stay intelligible. */
function duckMusic(seconds = 0.2): void {
  const ctx = sharedCtx;
  if (!ctx || !musicBus) return;
  const now = ctx.currentTime;
  musicBus.gain.cancelScheduledValues(now);
  musicBus.gain.setValueAtTime(DUCK_LEVEL, now);
  musicBus.gain.setValueAtTime(DUCK_LEVEL, now + seconds);
  musicBus.gain.exponentialRampToValueAtTime(MUSIC_LEVEL, now + seconds + 0.15);
}
