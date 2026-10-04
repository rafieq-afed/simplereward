<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
  kind: "logo" | "reward";
  label: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const uploading = ref(false);
const error = ref("");

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  error.value = "";
  uploading.value = true;
  try {
    const body = new FormData();
    body.append("file", file);
    body.append("kind", props.kind);
    const res = await $fetch<{ url: string }>("/api/merchant/upload", {
      method: "POST",
      body,
    });
    emit("update:modelValue", res.url);
  } catch (err: unknown) {
    const e2 = err as { data?: { statusMessage?: string }; statusMessage?: string };
    error.value = e2?.data?.statusMessage || e2?.statusMessage || "Upload failed";
  } finally {
    uploading.value = false;
    input.value = "";
  }
}

function clear() {
  emit("update:modelValue", "");
}
</script>

<template>
  <div class="brand-upload">
    <label class="brand-upload__label">{{ label }}</label>
    <div v-if="modelValue" class="brand-upload__preview">
      <img :src="modelValue" :alt="label" />
      <button class="btn btn--ghost btn--compact" type="button" @click="clear">Remove</button>
    </div>
    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" @change="onFile" />
    <p v-if="uploading" class="muted" style="margin: 0.35rem 0 0; font-size: 0.85rem">
      Uploading…
    </p>
    <p v-if="error" class="error" style="margin: 0.35rem 0 0">{{ error }}</p>
    <p class="muted" style="margin: 0.35rem 0 0; font-size: 0.8rem">
      Or paste a URL below. Max 1.5MB.
    </p>
    <input
      class="brand-upload__url"
      type="text"
      :value="modelValue"
      placeholder="/uploads/… or https://…"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>
