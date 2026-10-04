<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    showLogout?: boolean;
    showHome?: boolean;
  }>(),
  { showHome: true },
);
</script>

<template>
  <header class="app-topbar">
    <div class="app-topbar__text">
      <div class="app-topbar__title">{{ title }}</div>
      <p v-if="subtitle" class="app-topbar__sub">{{ subtitle }}</p>
    </div>
    <div class="app-topbar__actions">
      <NuxtLink v-if="showHome" class="btn btn--ghost btn--compact" to="/" aria-label="Home">
        Home
      </NuxtLink>
      <LogoutButton v-if="showLogout" />
    </div>
  </header>
</template>
