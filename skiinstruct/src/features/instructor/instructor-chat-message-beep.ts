import { unlockInstructorOrderBeep } from "@/features/instructor/instructor-order-beep";

let sharedCtx: AudioContext | null = null;

/** Разблокировать звук сообщений после клика/клавиши. */
export function unlockInstructorChatMessageBeep(): void {
  unlockInstructorOrderBeep();
  if (typeof window === "undefined") return;
  try {
    if (!sharedCtx) sharedCtx = new AudioContext();
    if (sharedCtx.state === "suspended") void sharedCtx.resume();
  } catch {
    /* ignore */
  }
}

/** Короткий сигнал о новом сообщении клиента (отличается от сигнала заявки). */
export function playInstructorChatMessageBeep() {
  if (typeof window === "undefined") return;
  try {
    if (!sharedCtx) sharedCtx = new AudioContext();
    const ctx = sharedCtx;
    const run = () => {
      const playTone = (freq: number, start: number, duration: number, peak: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.value = 0.001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.stop(start + duration + 0.02);
      };
      playTone(660, 0, 0.14, 0.16);
      playTone(880, 0.16, 0.14, 0.14);
      playTone(1047, 0.32, 0.2, 0.12);
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
