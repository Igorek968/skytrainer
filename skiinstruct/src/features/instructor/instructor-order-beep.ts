let sharedCtx: AudioContext | null = null;

/** Разблокировать звук после клика/клавиши (требование браузера). */
export function unlockInstructorOrderBeep(): void {
  if (typeof window === "undefined") return;
  try {
    if (!sharedCtx) sharedCtx = new AudioContext();
    if (sharedCtx.state === "suspended") void sharedCtx.resume();
  } catch {
    /* ignore */
  }
}

/** Короткий сигнал о новой заявке (браузер, без файла). */
export function playInstructorOrderBeep() {
  if (typeof window === "undefined") return;
  try {
    if (!sharedCtx) sharedCtx = new AudioContext();
    const ctx = sharedCtx;
    const run = () => {
      const playTone = (freq: number, start: number, duration: number, peak: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.value = 0.001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.stop(start + duration + 0.02);
      };
      playTone(880, 0, 0.22, 0.22);
      playTone(1175, 0.28, 0.28, 0.18);
    };
    if (ctx.state === "suspended") {
      void ctx.resume().then(run).catch(() => {});
    } else {
      run();
    }
  } catch {
    /* ignore */
  }
}
