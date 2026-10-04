<script setup lang="ts">
definePageMeta({ middleware: "guest" });

const shopName = ref("");
const ownerName = ref("");
const email = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

async function onSubmit() {
  error.value = "";
  loading.value = true;
  try {
    const data = await $fetch<{ redirectTo: string }>("/api/auth/signup", {
      method: "POST",
      body: {
        shopName: shopName.value,
        ownerName: ownerName.value,
        email: email.value,
        password: password.value,
      },
    });
    await navigateTo(data.redirectTo || "/merchant/onboarding");
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    error.value = err?.data?.statusMessage || err?.statusMessage || "Could not create shop";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="auth-screen">
    <div class="auth-screen__bar">
      <NuxtLink to="/" class="auth-screen__brand">Stamp</NuxtLink>
      <NuxtLink to="/login" class="btn btn--ghost btn--compact">Log in</NuxtLink>
    </div>
    <p class="muted" style="margin: 0 0 1.25rem">Create your shop in a minute</p>

    <section class="panel">
      <form @submit.prevent="onSubmit">
        <div class="field">
          <label for="shopName">Shop name</label>
          <input
            id="shopName"
            v-model="shopName"
            required
            minlength="2"
            maxlength="80"
            placeholder="Cookie Cafe"
            autocomplete="organization"
          />
        </div>
        <div class="field">
          <label for="ownerName">Your name</label>
          <input
            id="ownerName"
            v-model="ownerName"
            required
            minlength="2"
            maxlength="80"
            placeholder="Aina"
            autocomplete="name"
          />
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            inputmode="email"
          />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            minlength="6"
            autocomplete="new-password"
          />
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="btn btn--primary btn--block" type="submit" :disabled="loading">
          {{ loading ? "Creating…" : "Create shop" }}
        </button>
      </form>
    </section>

    <p class="muted" style="margin: 1rem 0 0; text-align: center; font-size: 0.9rem">
      Already have a shop?
      <NuxtLink to="/login">Log in</NuxtLink>
    </p>
  </main>
</template>
