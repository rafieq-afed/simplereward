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
import {
  FEATURE_CATALOG,
  TIER_TEMPLATES,
  type FeatureKey,
  type TierId,
} from "#shared/features";

definePageMeta({ middleware: "auth" });

type Campaign = {
  id: string;
  name: string;
  type: CampaignType;
  goal: number;
  rewardLabel: string;
  brandColor: string | null;
  rewardImageUrl: string | null;
  active: boolean;
  campaign: ReturnType<typeof campaignCopy>;
};

const { data, refresh } = await useFetch<{
  merchant: {
    name: string;
    slug: string;
    welcomeNote: string | null;
    requireJoinOtp: boolean;
    brandColor: string | null;
    logoUrl: string | null;
    cardTheme: CardTheme;
    fontFamily: BrandFont;
    instagramUrl: string | null;
    facebookUrl: string | null;
    tiktokUrl: string | null;
    whatsappUrl: string | null;
    quotedPrice: number;
  };
  plan: {
    features: Record<FeatureKey, boolean>;
    quotedPrice: number;
    catalog: typeof FEATURE_CATALOG;
    templates: { id: TierId; label: string; blurb: string; suggestedPrice: number }[];
    limits: { maxActiveCampaigns: number; maxStaff: number };
  };
  pendingUpgrade: {
    id: string;
    desiredTier: string | null;
    message: string | null;
    createdAt: string;
  } | null;
}>("/api/merchant/dashboard");

function can(feature: FeatureKey) {
  return Boolean(data.value?.plan?.features?.[feature]);
}

const { data: campData, refresh: refreshCamps } = await useFetch<{
  campaigns: Campaign[];
  activeCount: number;
}>("/api/merchant/campaigns");

const { data: staffData, refresh: refreshStaff } = await useFetch<{
  staff: { id: string; name: string }[];
}>("/api/merchant/staff");

const welcomeNote = ref("");
const requireJoinOtp = ref(true);
const brandColor = ref("#1f7a57");
const logoUrl = ref("");
const cardTheme = ref<CardTheme>("classic");
const fontFamily = ref<BrandFont>("syne");
const instagramUrl = ref("");
const facebookUrl = ref("");
const tiktokUrl = ref("");
const whatsappUrl = ref("");
const error = ref("");
const ok = ref("");
const loading = ref(false);

const newName = ref("");
const newType = ref<CampaignType>("STAMP");
const newGoal = ref(10);
const newReward = ref("Free item");
const newRewardImage = ref("");
const campError = ref("");
const campLoading = ref(false);
const editRewardImage = ref<Record<string, string>>({});

const staffName = ref("");
const staffPin = ref("");
const staffError = ref("");
const staffOk = ref("");
const staffLoading = ref(false);

const desiredTier = ref<TierId>("growth");
const upgradeMessage = ref("");
const upgradeError = ref("");
const upgradeOk = ref("");
const upgradeLoading = ref(false);

const campaignOptions = computed(() =>
  can("campaignTypes")
    ? CAMPAIGN_OPTIONS
    : CAMPAIGN_OPTIONS.filter((o) => o.value === "STAMP"),
);

const newCopy = computed(() => campaignCopy(newType.value));

const requestURL = useRequestURL();
const joinUrl = computed(() => {
  const slug = data.value?.merchant.slug;
  if (!slug) return "";
  const origin = import.meta.client ? window.location.origin : requestURL.origin;
  return `${origin}/m/${slug}?join=1`;
});

watch(
  () => data.value?.merchant,
  (m) => {
    if (!m) return;
    welcomeNote.value = m.welcomeNote || "";
    requireJoinOtp.value = m.requireJoinOtp !== false;
    brandColor.value = m.brandColor || "#1f7a57";
    logoUrl.value = m.logoUrl || "";
    cardTheme.value = (m.cardTheme as CardTheme) || "classic";
    fontFamily.value = (m.fontFamily as BrandFont) || "syne";
    instagramUrl.value = m.instagramUrl || "";
    facebookUrl.value = m.facebookUrl || "";
    tiktokUrl.value = m.tiktokUrl || "";
    whatsappUrl.value = m.whatsappUrl || "";
  },
  { immediate: true },
);

watch(
  () => campData.value?.campaigns,
  (list) => {
    for (const c of list || []) {
      if (editRewardImage.value[c.id] === undefined) {
        editRewardImage.value[c.id] = c.rewardImageUrl || "";
      }
    }
  },
  { immediate: true },
);

watch(newType, (type) => {
  const next = campaignCopy(type);
  newGoal.value = next.defaultGoal;
  newReward.value = next.defaultReward;
  if (!newName.value) newName.value = next.title;
});

async function saveShop() {
  error.value = "";
  ok.value = "";
  loading.value = true;
  try {
    await $fetch("/api/merchant/settings", {
      method: "PATCH",
      body: {
        welcomeNote: welcomeNote.value || null,
        requireJoinOtp: requireJoinOtp.value,
        brandColor: brandColor.value || null,
        logoUrl: logoUrl.value || null,
        cardTheme: cardTheme.value,
        fontFamily: fontFamily.value,
        instagramUrl: instagramUrl.value || null,
        facebookUrl: facebookUrl.value || null,
        tiktokUrl: tiktokUrl.value || null,
        whatsappUrl: whatsappUrl.value || null,
      },
    });
    ok.value = "Brand kit saved";
    await refresh();
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    error.value = err?.data?.statusMessage || err?.statusMessage || "Could not save";
  } finally {
    loading.value = false;
  }
}

async function addCampaign() {
  campError.value = "";
  campLoading.value = true;
  try {
    await $fetch("/api/merchant/campaigns", {
      method: "POST",
      body: {
        name: newName.value || newCopy.value.title,
        type: newType.value,
        goal: newGoal.value,
        rewardLabel: newReward.value,
        rewardImageUrl: newRewardImage.value || null,
      },
    });
    newName.value = "";
    newRewardImage.value = "";
    await refreshCamps();
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    campError.value = err?.data?.statusMessage || err?.statusMessage || "Could not add";
  } finally {
    campLoading.value = false;
  }
}

async function toggleCampaign(c: Campaign) {
  campError.value = "";
  try {
    await $fetch(`/api/merchant/campaigns/${c.id}`, {
      method: "PATCH",
      body: { active: !c.active },
    });
    await refreshCamps();
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    campError.value = err?.data?.statusMessage || err?.statusMessage || "Could not update";
  }
}

async function saveCampaignImage(c: Campaign) {
  campError.value = "";
  try {
    await $fetch(`/api/merchant/campaigns/${c.id}`, {
      method: "PATCH",
      body: { rewardImageUrl: editRewardImage.value[c.id] || null },
    });
    await refreshCamps();
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    campError.value = err?.data?.statusMessage || err?.statusMessage || "Could not save image";
  }
}

async function addStaff() {
  staffError.value = "";
  staffOk.value = "";
  staffLoading.value = true;
  try {
    await $fetch("/api/merchant/staff", {
      method: "POST",
      body: { name: staffName.value, pin: staffPin.value },
    });
    staffOk.value = `Added ${staffName.value}`;
    staffName.value = "";
    staffPin.value = "";
    await refreshStaff();
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    staffError.value = err?.data?.statusMessage || err?.statusMessage || "Could not add staff";
  } finally {
    staffLoading.value = false;
  }
}

async function removeStaff(id: string, name: string) {
  if (!confirm(`Remove ${name}?`)) return;
  try {
    await $fetch(`/api/merchant/staff/${id}`, { method: "DELETE" });
    await refreshStaff();
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    staffError.value = err?.data?.statusMessage || err?.statusMessage || "Could not remove";
  }
}

async function submitUpgrade() {
  upgradeError.value = "";
  upgradeOk.value = "";
  upgradeLoading.value = true;
  try {
    await $fetch("/api/merchant/upgrade-request", {
      method: "POST",
      body: {
        desiredTier: desiredTier.value,
        message: upgradeMessage.value || null,
      },
    });
    upgradeOk.value = "Request sent to admin";
    upgradeMessage.value = "";
    await refresh();
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    upgradeError.value =
      err?.data?.statusMessage || err?.statusMessage || "Could not send request";
  } finally {
    upgradeLoading.value = false;
  }
}
</script>

<template>
  <main class="app-shell app-shell--tabs">
    <AppTopBar
      :title="data?.merchant.name || 'Settings'"
      subtitle="Brand kit & campaigns"
      show-logout
    />

    <div class="app-body">
      <section class="panel no-print" style="margin-bottom: 1rem">
        <h2 style="margin-top: 0; font-size: 1.15rem">Plan & features</h2>
        <p class="muted" style="margin-top: 0">
          Quoted
          <strong>RM {{ data?.plan?.quotedPrice ?? data?.merchant.quotedPrice ?? 0 }}</strong>/mo ·
          Admin assigns features — request an upgrade below.
        </p>
        <ul class="feature-status-list">
          <li
            v-for="f in FEATURE_CATALOG"
            :key="f.key"
            :class="{ 'feature-status-list__on': can(f.key) }"
          >
            <span>
              <strong>{{ f.label }}</strong>
              <span class="muted"> — {{ f.blurb }}</span>
            </span>
            <span>{{ can(f.key) ? "On" : "Ask admin" }}</span>
          </li>
        </ul>

        <div v-if="data?.pendingUpgrade" class="success" style="margin-top: 0.85rem">
          Pending request
          {{ data.pendingUpgrade.desiredTier ? `(${data.pendingUpgrade.desiredTier})` : "" }}
          — waiting for admin.
        </div>
        <form v-else class="staff-form" style="margin-top: 0.85rem" @submit.prevent="submitUpgrade">
          <h3 style="margin: 0 0 0.45rem; font-size: 1rem">Request upgrade</h3>
          <div class="field">
            <label for="desiredTier">Suggested tier</label>
            <select id="desiredTier" v-model="desiredTier">
              <option
                v-for="t in data?.plan?.templates || TIER_TEMPLATES"
                :key="t.id"
                :value="t.id"
              >
                {{ t.label }}
                <template v-if="'suggestedPrice' in t && t.suggestedPrice != null">
                  · RM {{ t.suggestedPrice }}
                </template>
                — {{ t.blurb }}
              </option>
            </select>
          </div>
          <div class="field">
            <label for="upgradeMessage">Note (optional)</label>
            <textarea id="upgradeMessage" v-model="upgradeMessage" rows="2" />
          </div>
          <p v-if="upgradeError" class="error">{{ upgradeError }}</p>
          <p v-if="upgradeOk" class="success">{{ upgradeOk }}</p>
          <button class="btn btn--secondary" type="submit" :disabled="upgradeLoading">
            {{ upgradeLoading ? "Sending…" : "Send to admin" }}
          </button>
        </form>
      </section>

      <div class="grid-2">
        <section class="panel no-print">
          <h2 style="margin-top: 0; font-size: 1.15rem">Brand kit</h2>
          <form @submit.prevent="saveShop">
            <div class="field">
              <label for="welcomeNote">Welcome note</label>
              <textarea id="welcomeNote" v-model="welcomeNote" rows="2" />
            </div>
            <div class="field">
              <label for="brandColor">Brand color</label>
              <div class="color-row">
                <input v-model="brandColor" type="color" />
                <input id="brandColor" v-model="brandColor" maxlength="7" />
              </div>
            </div>

            <template v-if="can('brandKit')">
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

              <p style="margin: 0.25rem 0 0.4rem; font-weight: 650">Display font</p>
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
                  <span>Aa Bb Cc</span>
                </button>
              </div>
            </template>
            <p v-else class="muted" style="font-size: 0.85rem">
              Full brand kit (logo, themes, fonts) locked — ask admin.
            </p>

            <template v-if="can('socialLinks')">
              <p style="margin: 0.85rem 0 0.4rem; font-weight: 650">Social links</p>
              <p class="muted" style="margin: 0 0 0.55rem; font-size: 0.85rem">
                Shown on the customer card page. Handle, phone, or full URL.
              </p>
              <div class="field">
                <label for="instagramUrl">Instagram</label>
                <input
                  id="instagramUrl"
                  v-model="instagramUrl"
                  placeholder="@cookiecafe or https://instagram.com/…"
                />
              </div>
              <div class="field">
                <label for="facebookUrl">Facebook</label>
                <input
                  id="facebookUrl"
                  v-model="facebookUrl"
                  placeholder="Page name or https://facebook.com/…"
                />
              </div>
              <div class="field">
                <label for="tiktokUrl">TikTok</label>
                <input
                  id="tiktokUrl"
                  v-model="tiktokUrl"
                  placeholder="@shop or https://tiktok.com/@…"
                />
              </div>
              <div class="field">
                <label for="whatsappUrl">WhatsApp</label>
                <input
                  id="whatsappUrl"
                  v-model="whatsappUrl"
                  placeholder="0123456789 or https://wa.me/…"
                  inputmode="tel"
                />
              </div>
            </template>

            <label v-if="can('joinOtp')" class="check-row">
              <input v-model="requireJoinOtp" type="checkbox" />
              <span>Require OTP to join</span>
            </label>
            <p v-if="error" class="error">{{ error }}</p>
            <p v-if="ok" class="success">{{ ok }}</p>
            <button class="btn btn--primary btn--block" type="submit" :disabled="loading">
              {{ loading ? "Saving…" : "Save brand kit" }}
            </button>
          </form>

          <div style="margin-top: 1.1rem">
            <p class="muted" style="margin: 0 0 0.5rem; font-size: 0.85rem">Live preview</p>
            <StampCard
              customer-name="Aina"
              :stamps="Math.max(0, (campData?.campaigns?.[0]?.goal || 8) - 1)"
              :stamp-goal="campData?.campaigns?.[0]?.goal || 8"
              :reward-label="campData?.campaigns?.[0]?.rewardLabel || 'Free item'"
              :campaign-type="campData?.campaigns?.[0]?.type || 'STAMP'"
              :brand-color="brandColor"
              :logo-url="logoUrl || null"
              :shop-name="data?.merchant.name"
              :reward-image-url="campData?.campaigns?.[0]?.rewardImageUrl"
              :card-theme="cardTheme"
              :font-family="fontFamily"
            />
          </div>
        </section>

        <section class="panel join-qr-panel">
          <h2 class="no-print" style="margin-top: 0; font-size: 1.15rem">Join poster</h2>
          <JoinQr
            v-if="data?.merchant && joinUrl"
            :url="joinUrl"
            :shop-name="data.merchant.name"
            :stamp-goal="campData?.campaigns?.[0]?.goal || 10"
            :reward-label="campData?.campaigns?.[0]?.rewardLabel || 'rewards'"
            :allow-posters="can('posters')"
          />
        </section>
      </div>

      <section class="panel no-print" style="margin-top: 1rem">
        <h2 style="margin-top: 0; font-size: 1.15rem">Campaigns</h2>
        <p class="muted" style="margin-top: 0">
          Up to {{ data?.plan?.limits.maxActiveCampaigns ?? 1 }} active.
          Active: {{ campData?.activeCount ?? 0 }}/{{ data?.plan?.limits.maxActiveCampaigns ?? 1 }}
        </p>

        <ul class="campaign-admin-list">
          <li v-for="c in campData?.campaigns || []" :key="c.id" style="flex-wrap: wrap">
            <div style="flex: 1; min-width: 180px">
              <strong>{{ c.name }}</strong>
              <div class="muted" style="font-size: 0.85rem">
                {{ c.campaign.title }} · {{ c.goal }} → {{ c.rewardLabel }}
                · {{ c.active ? "Active" : "Off" }}
              </div>
              <div v-if="can('brandKit')" style="margin-top: 0.55rem">
                <BrandUpload
                  v-model="editRewardImage[c.id]"
                  kind="reward"
                  label="Reward image"
                />
                <button
                  class="btn btn--secondary btn--compact"
                  type="button"
                  @click="saveCampaignImage(c)"
                >
                  Save image
                </button>
              </div>
            </div>
            <button class="btn btn--ghost btn--compact" type="button" @click="toggleCampaign(c)">
              {{ c.active ? "Deactivate" : "Activate" }}
            </button>
          </li>
        </ul>

        <form
          v-if="can('multiCampaign') || (campData?.activeCount || 0) < 1"
          class="staff-form"
          style="margin-top: 1rem"
          @submit.prevent="addCampaign"
        >
          <h3 style="margin: 0 0 0.5rem; font-size: 1rem">Add campaign</h3>
          <div class="field">
            <label for="newName">Name</label>
            <input id="newName" v-model="newName" required />
          </div>
          <div class="field">
            <label for="newType">Type</label>
            <select id="newType" v-model="newType">
              <option v-for="opt in campaignOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="field">
            <label for="newGoal">{{ newCopy.goalLabel }}</label>
            <input
              id="newGoal"
              v-model.number="newGoal"
              type="number"
              :min="newType === 'STAMP' ? 2 : 1"
              max="50"
              required
            />
          </div>
          <div class="field">
            <label for="newReward">Reward</label>
            <input id="newReward" v-model="newReward" required />
          </div>
          <BrandUpload
            v-if="can('brandKit')"
            v-model="newRewardImage"
            kind="reward"
            label="Reward image (optional)"
          />
          <p v-if="campError" class="error">{{ campError }}</p>
          <button class="btn btn--secondary" type="submit" :disabled="campLoading">
            {{ campLoading ? "Adding…" : "Add campaign" }}
          </button>
        </form>
        <p v-else class="muted" style="margin-top: 0.85rem; font-size: 0.85rem">
          Multi-campaign locked — ask admin to unlock.
        </p>
      </section>

      <section v-if="can('staffPin')" class="panel no-print" style="margin-top: 1rem">
        <h2 style="margin-top: 0; font-size: 1.15rem">Staff PINs</h2>
        <ul v-if="staffData?.staff?.length" class="staff-list">
          <li v-for="s in staffData.staff" :key="s.id">
            <strong>{{ s.name }}</strong>
            <button class="btn btn--ghost" type="button" @click="removeStaff(s.id, s.name)">
              Remove
            </button>
          </li>
        </ul>
        <p v-else class="muted">No staff yet.</p>
        <form class="staff-form" @submit.prevent="addStaff">
          <div class="field">
            <label for="staffName">Name</label>
            <input id="staffName" v-model="staffName" required />
          </div>
          <div class="field">
            <label for="staffPin">PIN</label>
            <input
              id="staffPin"
              v-model="staffPin"
              required
              pattern="[0-9]{4,6}"
              maxlength="6"
              inputmode="numeric"
            />
          </div>
          <p v-if="staffError" class="error">{{ staffError }}</p>
          <p v-if="staffOk" class="success">{{ staffOk }}</p>
          <button class="btn btn--secondary" type="submit" :disabled="staffLoading">
            Add staff
          </button>
        </form>
      </section>
    </div>

    <MerchantTabBar class="no-print" />
  </main>
</template>
