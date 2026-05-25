/** Короткий сигнал о новой заявке (браузер, без файла). */
export function playInstructorOrderBeep() {
  try {
    const ctx = new AudioContext();
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
    window.setTimeout(() => void ctx.close(), 700);
  } catch {
    /* ignore */
  }
}
