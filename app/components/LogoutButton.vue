<script setup lang="ts">
async function logout() {
  await $fetch("/api/auth/logout", { method: "POST" });
  await navigateTo("/login");
}
</script>

<template>
  <button type="button" class="btn btn--ghost btn--compact" @click="logout">Log out</button>
</template>
