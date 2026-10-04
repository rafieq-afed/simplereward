<script setup lang="ts">
const visible = ref(false);
const dismissed = useCookie("sr_install_dismissed", { maxAge: 60 * 60 * 24 * 30 });

onMounted(() => {
  if (dismissed.value) return;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true;
  if (isStandalone) return;

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);
  visible.value = isIos || isAndroid;
});

function dismiss() {
  dismissed.value = "1";
  visible.value = false;
}
</script>

<template>
  <div v-if="visible" class="install-hint">
    <div>
      <strong>Keep this card handy</strong>
      <p class="muted" style="margin: 0.2rem 0 0">
        Add to Home Screen for one-tap access — no app store.
      </p>
    </div>
    <button class="btn btn--ghost" type="button" @click="dismiss">Got it</button>
  </div>
</template>
