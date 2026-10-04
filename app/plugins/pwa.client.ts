export default defineNuxtPlugin(() => {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore — e.g. private mode */
    });
  });
});
