<script setup lang="ts">
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

const emit = defineEmits<{
  scanned: [code: string];
  close: [];
}>();

const error = ref("");
const scanning = ref(false);
const hostId = `show-code-scanner-${Math.random().toString(36).slice(2, 9)}`;

let scanner: Html5Qrcode | null = null;

function parsePayload(raw: string) {
  const text = String(raw || "").trim();
  if (!text) return null;
  const fromPrefix = text.toLowerCase().startsWith("sr:") ? text.slice(3) : text;
  const digits = fromPrefix.replace(/\D/g, "").slice(0, 4);
  return digits.length === 4 ? digits : null;
}

async function stop() {
  if (!scanner) return;
  try {
    if (scanner.isScanning) await scanner.stop();
  } catch {
    /* ignore */
  }
  try {
    scanner.clear();
  } catch {
    /* ignore */
  }
  scanner = null;
  scanning.value = false;
}

async function start() {
  error.value = "";
  scanning.value = true;
  await nextTick();
  try {
    scanner = new Html5Qrcode(hostId, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });
    await scanner.start(
      { facingMode: "environment" },
      { fps: 8, qrbox: { width: 240, height: 240 } },
      async (decoded) => {
        const code = parsePayload(decoded);
        if (!code) return;
        await stop();
        emit("scanned", code);
      },
      () => {
        /* ignore frame misses */
      },
    );
  } catch (e: unknown) {
    scanning.value = false;
    const err = e as { message?: string };
    error.value =
      err?.message?.includes("Permission") || err?.message?.includes("NotAllowed")
        ? "Camera permission denied — type the code instead."
        : "Could not open camera — type the code instead.";
  }
}

async function close() {
  await stop();
  emit("close");
}

onMounted(() => {
  void start();
});

onBeforeUnmount(() => {
  void stop();
});
</script>

<template>
  <div class="scanner-overlay" role="dialog" aria-modal="true" aria-label="Scan show code">
    <div class="scanner-sheet">
      <div class="scanner-sheet__head">
        <h2>Scan buyer QR</h2>
        <button class="btn btn--ghost" type="button" @click="close">Close</button>
      </div>
      <p class="muted" style="margin-top: 0">Point at the QR on their stamp card.</p>
      <div :id="hostId" class="scanner-view" />
      <p v-if="error" class="error">{{ error }}</p>
      <p v-else-if="scanning" class="muted">Looking for QR…</p>
    </div>
  </div>
</template>
