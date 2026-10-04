<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    url: string;
    shopName: string;
    rewardLabel?: string;
    stampGoal?: number;
    allowPosters?: boolean;
  }>(),
  { allowPosters: true },
);

const dataUrl = ref("");
const copied = ref(false);
const posterSize = ref<"a6" | "a5">("a6");

async function render(url: string) {
  if (!import.meta.client || !url) return;
  const QRCode = (await import("qrcode")).default;
  dataUrl.value = await QRCode.toDataURL(url, {
    width: 320,
    margin: 2,
    color: { dark: "#15201c", light: "#ffffff" },
  });
}

onMounted(() => {
  void render(props.url);
});

watch(
  () => props.url,
  (url) => {
    void render(url);
  },
);

async function copyLink() {
  try {
    await navigator.clipboard.writeText(props.url);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1600);
  } catch {
    /* ignore */
  }
}

function printPoster(size: "a6" | "a5") {
  posterSize.value = size;
  document.documentElement.dataset.posterSize = size;
  nextTick(() => window.print());
}
</script>

<template>
  <div class="join-qr" :class="`join-qr--${posterSize}`">
    <div class="join-qr__preview join-poster">
      <p class="join-poster__brand">Stamp</p>
      <strong class="join-poster__shop">{{ shopName }}</strong>
      <p class="join-poster__reward">
        Collect {{ stampGoal || 10 }} stamps → {{ rewardLabel || "your reward" }}
      </p>
      <img v-if="dataUrl" :src="dataUrl" :alt="`QR for ${shopName}`" width="240" height="240" />
      <p v-else class="muted">Preparing QR…</p>
      <ol class="join-poster__steps">
        <li>Scan this QR</li>
        <li>Join with your phone</li>
        <li>Show your code at the counter</li>
      </ol>
    </div>

    <div class="join-qr__actions">
      <p class="join-qr__url muted">{{ url }}</p>
      <div class="cta-row">
        <button class="btn btn--secondary" type="button" @click="copyLink">
          {{ copied ? "Copied" : "Copy link" }}
        </button>
        <button
          v-if="allowPosters"
          class="btn btn--primary"
          type="button"
          @click="printPoster('a6')"
        >
          Print A6
        </button>
        <button
          v-if="allowPosters"
          class="btn btn--ghost"
          type="button"
          @click="printPoster('a5')"
        >
          Print A5
        </button>
        <a class="btn btn--ghost" :href="url" target="_blank" rel="noopener">Open link</a>
      </div>
    </div>
  </div>
</template>
