<script setup lang="ts">
const { data: session } = await useAsyncData("landing-session", async () => {
  try {
    return await $fetch<{ user: { role: string; name: string } }>("/api/auth/me");
  } catch {
    return null;
  }
});

const homeLink = computed(() => {
  if (session.value?.user.role === "ADMIN") {
    return { to: "/admin", label: "Admin" };
  }
  if (session.value?.user.role === "MERCHANT") {
    return { to: "/merchant", label: "Counter" };
  }
  return { to: "/login", label: "Log in" };
});

const demos = [
  {
    name: "Cookie Cafe",
    slug: "cookie-cafe",
    goal: 8,
    reward: "Free cookie or coffee",
    type: "Stamp card",
  },
  {
    name: "Bean & Brew",
    slug: "bean-and-brew",
    goal: 1,
    reward: "Free latte",
    type: "Buy 1 Free 1",
  },
  {
    name: "Kopi Corner",
    slug: "kopi-corner",
    goal: 3,
    reward: "Set pagi (kopi + 2 kuih)",
    type: "Bundle",
  },
] as const;

const shopIndex = ref(0);
const filled = ref(0);
const shop = computed(() => demos[shopIndex.value]);
const goal = computed(() => shop.value.goal);

let fillTimer: number | undefined;
let cycleTimer: number | undefined;

function clearTimers() {
  if (fillTimer) window.clearTimeout(fillTimer);
  if (cycleTimer) window.clearTimeout(cycleTimer);
}

function runFill() {
  clearTimers();
  filled.value = 0;
  let n = 0;
  const tick = () => {
    n += 1;
    filled.value = n;
    if (n < goal.value) {
      fillTimer = window.setTimeout(tick, 260 + n * 35);
    } else {
      cycleTimer = window.setTimeout(() => {
        shopIndex.value = (shopIndex.value + 1) % demos.length;
        runFill();
      }, 1400);
    }
  };
  fillTimer = window.setTimeout(tick, 400);
}

onMounted(runFill);
onBeforeUnmount(clearTimers);
</script>

<template>
  <div class="landing">
    <div class="landing__grain" aria-hidden="true" />

    <header class="landing-nav">
      <span class="landing-nav__mark">Stamp</span>
      <div class="landing-nav__actions">
        <NuxtLink class="landing-nav__login" :to="homeLink.to">{{ homeLink.label }}</NuxtLink>
        <NuxtLink
          v-if="!session?.user"
          class="landing-nav__signup"
          to="/signup"
        >
          Start free
        </NuxtLink>
        <NuxtLink
          v-else
          class="landing-nav__signup"
          :to="homeLink.to"
        >
          Open panel
        </NuxtLink>
      </div>
    </header>

    <section class="landing-hero">
      <div class="landing-hero__copy">
        <p class="landing-hero__brand">Stamp</p>
        <h1>Loyalty that fits on the counter.</h1>
        <p class="landing-hero__lede">
          Phone in. Stamp out. Customers keep their card in a link — no download.
        </p>
        <div class="landing-hero__cta">
          <NuxtLink class="landing-btn landing-btn--solid" to="/signup">Create your shop</NuxtLink>
          <a class="landing-btn landing-btn--line" href="#demos">Try a demo shop</a>
        </div>
      </div>

      <div class="landing-hero__visual" aria-hidden="true">
        <div class="landing-card" :key="shop.slug">
          <div class="landing-card__shine" />
          <p class="landing-card__shop">{{ shop.name }}</p>
          <p class="landing-card__meta">{{ filled }} / {{ goal }} · {{ shop.reward }}</p>
          <div
            class="landing-card__grid"
            :style="{ gridTemplateColumns: `repeat(${Math.min(goal, 5)}, 1fr)` }"
          >
            <span
              v-for="i in goal"
              :key="`${shop.slug}-${i}`"
              class="landing-card__slot"
              :class="{ 'landing-card__slot--on': i <= filled }"
            />
          </div>
          <p class="landing-card__nudge">
            {{ filled >= goal ? "Ready to redeem" : `${goal - filled} more to go` }}
          </p>
        </div>
      </div>
    </section>

    <section id="demos" class="landing-demos">
      <div class="landing-demos__inner">
        <h2>Try a demo shop</h2>
        <p>Open as a customer — same phone the merchant stamps.</p>
        <ul class="landing-demos__list">
          <li v-for="demo in demos" :key="demo.slug">
            <NuxtLink class="landing-demo" :to="`/m/${demo.slug}`">
              <span class="landing-demo__name">{{ demo.name }}</span>
              <span class="landing-demo__meta">
                {{ demo.type }} · {{ demo.goal }} → {{ demo.reward }}
              </span>
              <span class="landing-demo__go">Open card</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
