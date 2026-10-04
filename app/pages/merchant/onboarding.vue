<script setup lang="ts">
import {
  CAMPAIGN_OPTIONS,
  campaignCopy,
  type CampaignType,
} from "#shared/campaign";
import {
  BRAND_FONTS,
  CARD_THEMES,
  type BrandFont,
  type CardTheme,
} from "#shared/brand";

definePageMeta({ middleware: "auth" });

const { data, refresh } = await useFetch<{
  merchant: {
    name: string;
    slug: string;
    brandColor?: string | null;
    logoUrl?: string | null;
    cardTheme?: CardTheme | null;
    fontFamily?: BrandFont | null;
    onboardedAt: string | null;
  };
}>("/api/merchant/dashboard");

if (data.value?.merchant.onboardedAt) {
  await navigateTo("/merchant");
}

const step = ref<1 | 2 | 3>(1);
const name = ref(data.value?.merchant.name || "");
const brandColor = ref(data.value?.merchant.brandColor || "#1f7a57");
const logoUrl = ref(data.value?.merchant.logoUrl || "");
const cardTheme = ref<CardTheme>(data.value?.merchant.cardTheme || "classic");
const fontFamily = ref<BrandFont>(data.value?.merchant.fontFamily || "syne");
const campaignName = ref("Stamp card");
const campaignType = ref<CampaignType>("STAMP");
const stampGoal = ref(10);
const rewardLabel = ref("Free item");
const welcomeNote = ref("");
const error = ref("");
const loading = ref(false);

const copy = computed(() => campaignCopy(campaignType.value));

const requestURL = useRequestURL();
const joinUrl = computed(() => {
  const slug = data.value?.merchant.slug;
  if (!slug) return "";
  const origin = import.meta.client ? window.location.origin : requestURL.origin;
  return `${origin}/m/${slug}?join=1`;
});

watch(campaignType, (type) => {
  const next = campaignCopy(type);
  stampGoal.value = next.defaultGoal;
  rewardLabel.value = next.defaultReward;
  campaignName.value = next.title;
});

async function saveShop() {
  error.value = "";
  loading.value = true;
  try {
    await $fetch("/api/merchant/onboarding", {
      method: "POST",
      body: {
        step: "shop",
        name: name.value,
        brandColor: brandColor.value || null,
        logoUrl: logoUrl.value || null,
        cardTheme: cardTheme.value,
        fontFamily: fontFamily.value,
      },
    });
    await refresh();
    step.value = 2;
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    error.value = err?.data?.statusMessage || err?.statusMessage || "Could not save";
  } finally {
    loading.value = false;
  }
}

async function saveReward() {
  error.value = "";
  loading.value = true;
  try {
    await $fetch("/api/merchant/onboarding", {
      method: "POST",
      body: {
        step: "reward",
        campaignName: campaignName.value,
        campaignType: campaignType.value,
        stampGoal: stampGoal.value,
        rewardLabel: rewardLabel.value,
        welcomeNote: welcomeNote.value || null,
      },
    });
    await refresh();
    step.value = 3;
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    error.value = err?.data?.statusMessage || err?.statusMessage || "Could not save";
  } finally {
    loading.value = false;
  }
}

async function finish() {
  error.value = "";
  loading.value = true;
  try {
    await $fetch("/api/merchant/onboarding", {
      method: "POST",
      body: { step: "done" },
    });
    await navigateTo("/merchant");
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    error.value = err?.data?.statusMessage || err?.statusMessage || "Could not finish";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="app-shell">
    <AppTopBar :title="data?.merchant.name || 'Setup'" subtitle="Shop setup" show-logout />

    <div class="app-body">
      <ol class="onboard-steps">
        <li :class="{ 'onboard-steps__item--on': step === 1, 'onboard-steps__item--done': step > 1 }">
          1 · Shop
        </li>
        <li :class="{ 'onboard-steps__item--on': step === 2, 'onboard-steps__item--done': step > 2 }">
          2 · First campaign
        </li>
        <li :class="{ 'onboard-steps__item--on': step === 3 }">3 · QR</li>
      </ol>

      <section v-if="step === 1" class="panel">
        <h1 style="margin-top: 0; font-size: 1.35rem">Name & brand</h1>
        <form @submit.prevent="saveShop">
          <div class="field">
            <label for="name">Shop name</label>
            <input id="name" v-model="name" required minlength="2" />
          </div>
          <div class="field">
            <label for="brandColor">Brand color</label>
            <div class="color-row">
              <input v-model="brandColor" type="color" />
              <input id="brandColor" v-model="brandColor" maxlength="7" />
            </div>
          </div>
          <BrandUpload v-model="logoUrl" kind="logo" label="Logo" />

          <p style="margin: 0.25rem 0 0.4rem; font-weight: 650">Card theme</p>
          <div class="theme-grid">
            <button
              v-for="t in CARD_THEMES"
              :key="t.value"
              type="button"
              class="theme-grid__btn"
              :class="{ 'theme-grid__btn--on': cardTheme === t.value }"
              @click="cardTheme = t.value"
            >
              <strong>{{ t.label }}</strong>
              <span>{{ t.blurb }}</span>
            </button>
          </div>

          <p style="margin: 0.25rem 0 0.4rem; font-weight: 650">Font</p>
          <div class="font-grid">
            <button
              v-for="f in BRAND_FONTS"
              :key="f.value"
              type="button"
              class="font-grid__btn"
              :class="{ 'font-grid__btn--on': fontFamily === f.value }"
              :style="{ fontFamily: f.css }"
              @click="fontFamily = f.value"
            >
              <strong>{{ f.label }}</strong>
              <span>Aa Bb</span>
            </button>
          </div>

          <p v-if="error" class="error">{{ error }}</p>
          <button class="btn btn--primary btn--block" type="submit" :disabled="loading">
            Continue
          </button>
        </form>
      </section>

      <section v-else-if="step === 2" class="panel">
        <h1 style="margin-top: 0; font-size: 1.35rem">Your first campaign</h1>
        <p class="muted" style="margin-top: 0">
          {{ copy.blurb }} You can add more promos later in Settings.
        </p>
        <form @submit.prevent="saveReward">
          <div class="field">
            <label for="campaignName">Campaign name</label>
            <input id="campaignName" v-model="campaignName" required />
          </div>
          <div class="field">
            <label for="campaignType">Type</label>
            <select id="campaignType" v-model="campaignType">
              <option v-for="opt in CAMPAIGN_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="field">
            <label for="stampGoal">{{ copy.goalLabel }}</label>
            <input
              id="stampGoal"
              v-model.number="stampGoal"
              type="number"
              :min="campaignType === 'STAMP' ? 2 : 1"
              max="50"
              required
            />
          </div>
          <div class="field">
            <label for="rewardLabel">Reward</label>
            <input id="rewardLabel" v-model="rewardLabel" required />
          </div>
          <div class="field">
            <label for="welcomeNote">Note</label>
            <textarea id="welcomeNote" v-model="welcomeNote" rows="2" />
          </div>
          <p v-if="error" class="error">{{ error }}</p>
          <div class="cta-row cta-row--stack">
            <button class="btn btn--primary" type="submit" :disabled="loading">Continue</button>
            <button class="btn btn--ghost" type="button" @click="step = 1">Back</button>
          </div>
        </form>
      </section>

      <section v-else class="panel join-qr-panel">
        <h1 class="no-print" style="margin-top: 0; font-size: 1.35rem">Print join QR</h1>
        <JoinQr
          v-if="data?.merchant && joinUrl"
          :url="joinUrl"
          :shop-name="data.merchant.name"
          :stamp-goal="stampGoal"
          :reward-label="rewardLabel"
        />
        <p v-if="error" class="error no-print">{{ error }}</p>
        <div class="cta-row cta-row--stack no-print" style="margin-top: 1rem">
          <button class="btn btn--primary" type="button" :disabled="loading" @click="finish">
            Open counter
          </button>
          <button class="btn btn--ghost" type="button" @click="step = 2">Back</button>
        </div>
      </section>
    </div>
  </main>
</template>
