// Three chimes made with Web Audio, so nothing ships as a sound file. Browsers only allow audio
// after a click, which is what the Arm audio button on the setup panel is for. All under 2 seconds.
export type ChimeKind = "soft" | "medium" | "big";

let ctx: AudioContext | null = null;
let out: GainNode | null = null;

export function armAudio(): boolean {
  if (typeof window === "undefined") return false;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    out = ctx.createGain();
    out.gain.value = 0.7;
    out.connect(comp);
    comp.connect(ctx.destination);
  }
  void ctx.resume();
  return true;
}

export const audioArmed = () => Boolean(ctx && ctx.state === "running");

function bell(freq: number, start: number, dur: number, gain: number) {
  if (!ctx || !out) return;
  for (const [mult, g] of [[1, 1], [2.01, 0.35], [3.02, 0.12]] as const) {
    const o = ctx.createOscillator();
    const e = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq * mult;
    e.gain.setValueAtTime(0.0001, start);
    e.gain.exponentialRampToValueAtTime(gain * g, start + 0.012);
    e.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(e);
    e.connect(out);
    o.start(start);
    o.stop(start + dur + 0.05);
  }
}

export function chime(kind: ChimeKind) {
  if (!ctx) return;
  const t = ctx.currentTime + 0.03;
  if (kind === "soft") bell(880, t, 0.9, 0.22);
  else if (kind === "medium") { bell(659.25, t, 1.0, 0.28); bell(987.77, t + 0.2, 1.2, 0.28); }
  else [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, t + i * 0.13, 1.45, 0.26));
}
