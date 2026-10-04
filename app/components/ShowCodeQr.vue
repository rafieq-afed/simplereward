<script setup lang="ts">
const props = defineProps<{
  code: string;
}>();

const dataUrl = ref("");

async function render(code: string) {
  if (!import.meta.client || !code) {
    dataUrl.value = "";
    return;
  }
  const QRCode = (await import("qrcode")).default;
  const payload = `sr:${code}`;
  dataUrl.value = await QRCode.toDataURL(payload, {
    width: 220,
    margin: 1,
    color: { dark: "#f3f7f4", light: "#1a2e26" },
    errorCorrectionLevel: "M",
  });
}

onMounted(() => {
  void render(props.code);
});

watch(
  () => props.code,
  (code) => {
    void render(code);
  },
);
</script>

<template>
  <div class="show-code-qr">
    <img v-if="dataUrl" :src="dataUrl" alt="Show code QR for cashier" width="180" height="180" />
    <p v-else class="show-code__meta">Preparing QR…</p>
  </div>
</template>
