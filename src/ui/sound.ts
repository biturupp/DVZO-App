let ctx: AudioContext | null = null;

/** Muss einmal durch eine Berührung aktiviert werden (Browser-Regel). */
export async function enableSound(): Promise<boolean> {
  try {
    ctx = ctx ?? new AudioContext();
    await ctx.resume();
    beep();
    return true;
  } catch {
    return false;
  }
}

export const soundEnabled = () => !!ctx && ctx.state === 'running';

/** Zwei kurze Töne plus Vibration (wo vorhanden). */
export function beep() {
  try {
    navigator.vibrate?.([250, 120, 250]);
  } catch {
    /* nicht unterstützt */
  }
  if (!ctx) return;
  for (const offset of [0, 0.35]) {
    const t = ctx.currentTime + offset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.start(t);
    osc.stop(t + 0.3);
  }
}

/** Bildschirm während der Fahrt eingeschaltet lassen (GPS läuft im Browser nur bei aktivem Bildschirm). */
export async function keepScreenOn() {
  try {
    await (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<unknown> } }).wakeLock?.request('screen');
    return true;
  } catch {
    return false;
  }
}
