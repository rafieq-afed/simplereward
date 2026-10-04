<script setup lang="ts">
definePageMeta({ middleware: "guest" });

const demos = [
  { label: "Cookie Cafe", email: "merchant@cookie.cafe" },
  { label: "Bean & Brew", email: "merchant@beanbrew.cafe" },
  { label: "Kopi Corner", email: "merchant@kopicorn.cafe" },
] as const;

const email = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

function useDemo(demoEmail: string) {
  email.value = demoEmail;
  password.value = "merchant123";
}

async function onSubmit() {
  error.value = "";
  loading.value = true;
  try {
    const data = await $fetch<{ redirectTo: string }>("/api/auth/login", {
      method: "POST",
      body: { email: email.value, password: password.value },
    });
    await navigateTo(data.redirectTo || "/");
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    error.value = err?.data?.statusMessage || err?.statusMessage || "Login failed";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="auth-screen">
    <div class="auth-screen__bar">
      <NuxtLink to="/" class="auth-screen__brand">Stamp</NuxtLink>
      <NuxtLink to="/" class="btn btn--ghost btn--compact">Home</NuxtLink>
    </div>
    <p class="muted" style="margin: 0 0 1.25rem">
      Shop counter login ·
      <NuxtLink to="/signup">Create a shop</NuxtLink>
    </p>

    <section class="panel">
      <form @submit.prevent="onSubmit">
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
            autocomplete="current-password"
          />
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="btn btn--primary btn--block" type="submit" :disabled="loading">
          {{ loading ? "Signing in…" : "Sign in" }}
        </button>
      </form>
    </section>

    <section class="auth-demos">
      <p class="muted" style="margin: 0 0 0.55rem; font-size: 0.85rem">
        Demo shops — password <strong>merchant123</strong>
      </p>
      <div class="auth-demos__list">
        <button
          v-for="demo in demos"
          :key="demo.email"
          type="button"
          class="auth-demos__btn"
          @click="useDemo(demo.email)"
        >
          {{ demo.label }}
        </button>
      </div>
      <p class="muted" style="margin: 0.65rem 0 0; font-size: 0.8rem">
        Admin: admin@example.com / admin123
      </p>
    </section>
  </main>
</template>
