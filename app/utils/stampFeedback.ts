/** Short haptic + soft beep after a successful stamp. */
export function playStampFeedback() {
  if (!import.meta.client) return;

  try {
    if (navigator.vibrate) navigator.vibrate([18, 30, 18]);
  } catch {
    /* ignore */
  }

  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.stop(ctx.currentTime + 0.13);
    window.setTimeout(() => {
      void ctx.close();
    }, 200);
  } catch {
    /* ignore autoplay / audio limits */
  }
}
