<script setup lang="ts">
import { hasAnySocial, type SocialLinks } from "#shared/social";

const props = defineProps<{
  links?: Partial<SocialLinks> | null;
}>();

const items = computed(() => {
  const list: { label: string; href: string; key: string }[] = [];
  if (props.links?.instagramUrl) {
    list.push({ key: "ig", label: "Instagram", href: props.links.instagramUrl });
  }
  if (props.links?.facebookUrl) {
    list.push({ key: "fb", label: "Facebook", href: props.links.facebookUrl });
  }
  if (props.links?.tiktokUrl) {
    list.push({ key: "tt", label: "TikTok", href: props.links.tiktokUrl });
  }
  if (props.links?.whatsappUrl) {
    list.push({ key: "wa", label: "WhatsApp", href: props.links.whatsappUrl });
  }
  return list;
});

const visible = computed(() => hasAnySocial(props.links) && items.value.length > 0);
</script>

<template>
  <nav v-if="visible" class="social-links" aria-label="Shop social links">
    <a
      v-for="item in items"
      :key="item.key"
      class="social-links__a"
      :href="item.href"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ item.label }}
    </a>
  </nav>
</template>
