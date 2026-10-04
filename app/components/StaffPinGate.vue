<script setup lang="ts">
defineProps<{
  required: boolean;
  staffName?: string | null;
}>();

const emit = defineEmits<{
  unlocked: [staff: { id: string; name: string }];
  locked: [];
}>();

const pin = ref("");
const error = ref("");
const loading = ref(false);

async function unlock() {
  error.value = "";
  loading.value = true;
  try {
    const res = await $fetch<{ staff: { id: string; name: string } }>(
      "/api/merchant/staff/unlock",
      { method: "POST", body: { pin: pin.value } },
    );
    pin.value = "";
    emit("unlocked", res.staff);
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    error.value = err?.data?.statusMessage || err?.statusMessage || "Wrong PIN";
  } finally {
    loading.value = false;
  }
}

async function lock() {
  await $fetch("/api/merchant/staff/lock", { method: "POST" });
  emit("locked");
}

function press(digit: string) {
  if (pin.value.length >= 6) return;
  pin.value += digit;
  if (pin.value.length >= 4) {
    void unlock();
  }
}

function backspace() {
  pin.value = pin.value.slice(0, -1);
  error.value = "";
}
</script>

<template>
  <div v-if="required && !staffName" class="staff-gate">
    <div class="staff-gate__card panel">
      <h1 style="margin-top: 0; font-size: 1.4rem">Staff PIN</h1>
      <p class="muted" style="margin-top: 0">Unlock the counter for this shift.</p>
      <p class="staff-gate__dots" aria-hidden="true">
        <span v-for="i in 6" :key="i" :class="{ on: pin.length >= i }" />
      </p>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="pin-pad">
        <button
          v-for="n in ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']"
          :key="n || 'blank'"
          type="button"
          class="pin-pad__key"
          :disabled="!n || loading"
          :class="{ 'pin-pad__key--ghost': !n }"
          @click="n === '⌫' ? backspace() : n && press(n)"
        >
          {{ n === "⌫" ? "⌫" : n }}
        </button>
      </div>
    </div>
  </div>

  <div v-else-if="required && staffName" class="staff-chip">
    <span>{{ staffName }}</span>
    <button type="button" class="linkish" @click="lock">Lock</button>
  </div>
</template>
