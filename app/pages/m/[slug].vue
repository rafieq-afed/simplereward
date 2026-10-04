<script setup lang="ts">
const route = useRoute();
const slug = computed(() => String(route.params.slug));

const { data: shop, error: shopError } = await useFetch(() => `/api/public/${slug.value}`);

if (shopError.value) {
  throw createError({ statusCode: 404, statusMessage: "Shop not found" });
}

type CardData = {
  name: string;
  phone: string;
  stamps: number;
  totalRedeemed: number;
  cardCode?: string | null;
  showCode?: string | null;
  showCodeExpiresIn?: number;
  birthdayMd?: string | null;
};

type Enrollment = {
  progress: number;
  totalRedeemed: number;
  campaign: {
    id: string;
    name: string;
    type: string;
    goal: number;
    rewardLabel: string;
    brandColor: string | null;
    rewardImageUrl?: string | null;
  };
};

const phone = ref("");
const name = ref("");
const otp = ref("");
const birthdayMd = ref("");
const otpSent = ref(false);
const mode = ref<"lookup" | "join">(
  route.query.join === "1" || route.query.join === "true" ? "join" : "lookup",
);
const error = ref("");
const loading = ref(false);
const card = ref<CardData | null>(null);
const enrollments = ref<Enrollment[]>([]);
const selectedCampaignId = ref("");
const expiresIn = ref(0);
const birthdayMsg = ref("");

const merchant = computed(() => shop.value?.merchant);
const requireOtp = computed(() => Boolean(merchant.value?.requireJoinOtp));
const selectedEnrollment = computed(
  () =>
    enrollments.value.find((e) => e.campaign.id === selectedCampaignId.value) ||
    enrollments.value[0] ||
    null,
);

function applyCardPayload(res: {
  customer: CardData;
  enrollments?: Enrollment[];
}) {
  card.value = res.customer;
  enrollments.value = res.enrollments || [];
  if (
    !enrollments.value.some((e) => e.campaign.id === selectedCampaignId.value)
  ) {
    selectedCampaignId.value = enrollments.value[0]?.campaign.id || "";
  }
  birthdayMd.value = res.customer.birthdayMd || "";
  startExpiryCountdown(res.customer.showCodeExpiresIn || 120);
}

let refreshTimer: number | undefined;
let tickTimer: number | undefined;

function clearTimers() {
  if (refreshTimer) window.clearTimeout(refreshTimer);
  if (tickTimer) window.clearInterval(tickTimer);
}

function startExpiryCountdown(seconds: number) {
  clearTimers();
  expiresIn.value = seconds;
  tickTimer = window.setInterval(() => {
    expiresIn.value = Math.max(0, expiresIn.value - 1);
  }, 1000);
  refreshTimer = window.setTimeout(
    () => {
      if (phone.value && card.value) void refreshShowCode();
    },
    Math.max(5, seconds - 10) * 1000,
  );
}

async function refreshShowCode() {
  try {
    const res = await $fetch<{ customer: CardData; enrollments?: Enrollment[] }>(
      `/api/public/${slug.value}/card`,
      {
        query: {
          phone: phone.value,
          campaignId: selectedCampaignId.value || undefined,
        },
      },
    );
    applyCardPayload(res);
  } catch {
    /* keep old card UI */
  }
}

async function lookup() {
  error.value = "";
  loading.value = true;
  try {
    const res = await $fetch<{ customer: CardData; enrollments?: Enrollment[] }>(
      `/api/public/${slug.value}/card`,
      { query: { phone: phone.value } },
    );
    applyCardPayload(res);
    mode.value = "lookup";
  } catch (e: unknown) {
    const err = e as { data?: { data?: { code?: string }; statusMessage?: string } };
    if (err?.data?.data?.code === "NOT_FOUND") {
      mode.value = "join";
      error.value = "No card yet — join with your name.";
    } else {
      error.value = err?.data?.statusMessage || "Could not load card";
    }
  } finally {
    loading.value = false;
  }
}

async function sendOtp() {
  error.value = "";
  loading.value = true;
  try {
    const res = await $fetch<{
      required: boolean;
      devOtp?: string;
      sent?: boolean;
    }>(`/api/public/${slug.value}/otp`, {
      method: "POST",
      body: { phone: phone.value, name: name.value },
    });
    if (!res.required) {
      await join();
      return;
    }
    otpSent.value = true;
    error.value = res.devOtp
      ? `Demo code: ${res.devOtp} (WhatsApp not configured)`
      : "Code sent via WhatsApp.";
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    error.value = err?.data?.statusMessage || err?.statusMessage || "Could not send code";
  } finally {
    loading.value = false;
  }
}

async function join() {
  error.value = "";
  loading.value = true;
  try {
    const res = await $fetch<{ customer: CardData; enrollments?: Enrollment[] }>(
      `/api/public/${slug.value}`,
      {
        method: "POST",
        body: {
          phone: phone.value,
          name: name.value,
          otp: otp.value || undefined,
          birthdayMd: birthdayMd.value || undefined,
        },
      },
    );
    applyCardPayload(res);
    mode.value = "lookup";
    otpSent.value = false;
  } catch (e: unknown) {
    const err = e as {
      data?: { statusMessage?: string; data?: { code?: string } };
      statusMessage?: string;
    };
    if (err?.data?.data?.code === "OTP_REQUIRED") {
      error.value = "Request a code first.";
      otpSent.value = false;
    } else {
      error.value = err?.data?.statusMessage || err?.statusMessage || "Could not join";
    }
  } finally {
    loading.value = false;
  }
}

async function saveBirthday() {
  birthdayMsg.value = "";
  try {
    await $fetch(`/api/public/${slug.value}/birthday`, {
      method: "PATCH",
      body: { phone: phone.value, birthdayMd: birthdayMd.value },
    });
    birthdayMsg.value = "Birthday saved — free stamp on your day.";
    if (card.value) card.value.birthdayMd = birthdayMd.value;
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    birthdayMsg.value = err?.data?.statusMessage || err?.statusMessage || "Could not save";
  }
}

function closeCard() {
  clearTimers();
  card.value = null;
  enrollments.value = [];
  selectedCampaignId.value = "";
  otpSent.value = false;
  otp.value = "";
}

onBeforeUnmount(clearTimers);
</script>

<template>
  <main class="app-shell app-shell--customer">
    <div class="customer-screen">
      <div class="customer-screen__top">
        <div class="customer-screen__bar">
          <NuxtLink to="/" class="customer-screen__mark">Stamp</NuxtLink>
          <NuxtLink to="/" class="customer-screen__home">Home</NuxtLink>
        </div>
        <h1>{{ merchant?.name }}</h1>
        <p>
          {{
            merchant?.welcomeNote ||
            `Collect ${merchant?.stampGoal} stamps for ${merchant?.rewardLabel}.`
          }}
        </p>
        <ShopSocialLinks
          v-if="merchant"
          :links="{
            instagramUrl: merchant.instagramUrl,
            facebookUrl: merchant.facebookUrl,
            tiktokUrl: merchant.tiktokUrl,
            whatsappUrl: merchant.whatsappUrl,
          }"
        />
      </div>

      <div class="customer-sheet">
        <div class="panel">
          <div v-if="card && merchant">
            <div v-if="enrollments.length > 1" class="campaign-picker" style="margin-bottom: 0.85rem">
              <button
                v-for="e in enrollments"
                :key="e.campaign.id"
                type="button"
                class="campaign-picker__btn"
                :class="{ 'campaign-picker__btn--on': e.campaign.id === selectedCampaignId }"
                @click="selectedCampaignId = e.campaign.id"
              >
                <strong>{{ e.campaign.name }}</strong>
                <span>{{ e.progress }}/{{ e.campaign.goal }} · {{ e.campaign.rewardLabel }}</span>
              </button>
            </div>

            <StampCard
              v-if="selectedEnrollment"
              :customer-name="card.name"
              :stamps="selectedEnrollment.progress"
              :stamp-goal="selectedEnrollment.campaign.goal"
              :reward-label="selectedEnrollment.campaign.rewardLabel"
              :campaign-type="selectedEnrollment.campaign.type"
              :brand-color="selectedEnrollment.campaign.brandColor || merchant.brandColor"
              :logo-url="merchant.logoUrl"
              :shop-name="selectedEnrollment.campaign.name"
              :reward-image-url="selectedEnrollment.campaign.rewardImageUrl"
              :card-theme="merchant.cardTheme"
              :font-family="merchant.fontFamily"
            />

            <div class="show-code">
              <p class="show-code__label">Show this to cashier</p>
              <ShowCodeQr v-if="card.showCode" :code="card.showCode" />
              <p class="show-code__digits">{{ card.showCode || "····" }}</p>
              <p class="show-code__meta">
                Valid ~{{ expiresIn }}s · Card {{ card.cardCode || "—" }}
              </p>
              <button class="btn btn--ghost btn--block" type="button" @click="refreshShowCode">
                Refresh code
              </button>
            </div>

            <InstallHint />

            <div v-if="merchant.features?.birthdayBonus" class="field" style="margin-top: 1rem">
              <label for="birthday">Birthday (MM-DD) — free stamp</label>
              <div class="cta-row">
                <input
                  id="birthday"
                  v-model="birthdayMd"
                  placeholder="08-03"
                  maxlength="5"
                  inputmode="numeric"
                  style="flex: 1"
                />
                <button class="btn btn--secondary" type="button" @click="saveBirthday">
                  Save
                </button>
              </div>
              <p v-if="birthdayMsg" class="muted" style="margin: 0.35rem 0 0; font-size: 0.85rem">
                {{ birthdayMsg }}
              </p>
            </div>

            <NuxtLink
              v-if="merchant.features?.walletPass"
              class="btn btn--secondary btn--block"
              style="margin-top: 0.85rem"
              :to="`/m/${slug}/pass?phone=${encodeURIComponent(phone)}`"
            >
              Open wallet pass
            </NuxtLink>

            <p class="muted" style="margin-top: 1rem">
              Redeemed {{ card.totalRedeemed }} time{{ card.totalRedeemed === 1 ? "" : "s" }}.
            </p>
            <button
              class="btn btn--ghost btn--block"
              type="button"
              style="margin-top: 0.85rem"
              @click="closeCard"
            >
              Check another phone
            </button>
          </div>

          <form
            v-else-if="mode === 'join'"
            @submit.prevent="requireOtp && !otpSent ? sendOtp() : join()"
          >
            <h2 style="margin-top: 0; font-size: 1.25rem">
              {{ route.query.join ? "Welcome — join" : "Join the card" }}
            </h2>
            <div class="field">
              <label for="name">Name</label>
              <input id="name" v-model="name" required autocomplete="name" />
            </div>
            <div class="field">
              <label for="phone">Phone</label>
              <input
                id="phone"
                v-model="phone"
                required
                inputmode="tel"
                autocomplete="tel"
                placeholder="60123456789"
              />
            </div>
            <div class="field">
              <template v-if="merchant?.features?.birthdayBonus">
                <label for="bdayJoin">Birthday (optional, MM-DD)</label>
                <input id="bdayJoin" v-model="birthdayMd" placeholder="08-03" maxlength="5" />
              </template>
            </div>
            <div v-if="requireOtp && otpSent" class="field">
              <label for="otp">6-digit code</label>
              <input
                id="otp"
                v-model="otp"
                required
                inputmode="numeric"
                maxlength="6"
                pattern="[0-9]*"
                placeholder="123456"
                autocomplete="one-time-code"
              />
            </div>
            <p v-if="error" class="error">{{ error }}</p>
            <div class="cta-row cta-row--stack">
              <button class="btn btn--primary" type="submit" :disabled="loading">
                {{
                  loading
                    ? "Working…"
                    : requireOtp && !otpSent
                      ? "Send code"
                      : "Join"
                }}
              </button>
              <button
                v-if="requireOtp && otpSent"
                class="btn btn--ghost"
                type="button"
                :disabled="loading"
                @click="sendOtp"
              >
                Resend code
              </button>
              <button
                class="btn btn--ghost"
                type="button"
                @click="
                  mode = 'lookup';
                  error = '';
                "
              >
                I already have a card
              </button>
            </div>
          </form>

          <form v-else @submit.prevent="lookup">
            <h2 style="margin-top: 0; font-size: 1.25rem">View your card</h2>
            <p class="muted">Open your card, then show the code at the counter.</p>
            <div class="field">
              <label for="phoneLookup">Phone</label>
              <input
                id="phoneLookup"
                v-model="phone"
                required
                inputmode="tel"
                autocomplete="tel"
                placeholder="60123456789"
              />
            </div>
            <p v-if="error" class="error">{{ error }}</p>
            <div class="cta-row cta-row--stack">
              <button class="btn btn--primary" type="submit" :disabled="loading">
                {{ loading ? "Loading…" : "Show card" }}
              </button>
              <button
                class="btn btn--secondary"
                type="button"
                @click="
                  mode = 'join';
                  error = '';
                "
              >
                Join first
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </main>
</template>
