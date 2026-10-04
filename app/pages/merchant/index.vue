<script setup lang="ts">
import { campaignCopy, type CampaignType } from "#shared/campaign";

definePageMeta({ middleware: "auth" });

type Customer = {
  id: string;
  name: string;
  phone: string;
  stamps: number;
  progress?: number;
};

type Campaign = {
  id: string;
  name: string;
  type: CampaignType;
  goal: number;
  rewardLabel: string;
  brandColor: string | null;
  doubleActive: boolean;
  campaign: ReturnType<typeof campaignCopy>;
};

const { data, refresh } = await useFetch<{
  merchant: {
    name: string;
    slug: string;
    brandColor: string | null;
    logoUrl: string | null;
    cardTheme?: string | null;
    fontFamily?: string | null;
  };
  plan?: {
    features: Record<string, boolean>;
  };
  campaigns: (Campaign & { rewardImageUrl?: string | null })[];
  stats: {
    customerCount: number;
    readyCount: number;
    stampsToday: number;
    redeemsToday: number;
    stampsWeek: number;
    redeemsWeek: number;
    newCustomersWeek: number;
  };
  recent: Customer[];
  almostThere: (Customer & { campaignId: string; campaignName: string; stampGoal: number })[];
  user: { name: string };
}>("/api/merchant/dashboard");

function can(feature: string) {
  return Boolean(data.value?.plan?.features?.[feature]);
}

const { data: staffState, refresh: refreshStaff } = await useFetch<{
  staff: { id: string; name: string }[];
  required: boolean;
  current: { id: string; name: string } | null;
}>("/api/merchant/staff");

const campaignId = ref(data.value?.campaigns?.[0]?.id || "");
watch(
  () => data.value?.campaigns,
  (list) => {
    if (!list?.length) return;
    if (!list.some((c) => c.id === campaignId.value)) {
      campaignId.value = list[0].id;
    }
  },
  { immediate: true },
);

const selected = computed(
  () => data.value?.campaigns.find((c) => c.id === campaignId.value) || data.value?.campaigns?.[0],
);
const copy = computed(() => selected.value?.campaign || campaignCopy("STAMP"));

const entryMode = ref<"show" | "phone">("show");
const showCode = ref("");
const phone = ref("");
const name = ref("");
const amount = ref(1);
const needName = ref(false);
const error = ref("");
const message = ref("");
const loading = ref(false);
const customer = ref<Customer | null>(null);
const verified = ref(false);
const scanning = ref(false);
const undoing = ref(false);
const promoLoading = ref(false);

const { data: lastStamp, refresh: refreshLastStamp } = await useFetch<{
  undoable: {
    amount: number;
    createdAt: string;
    campaignId: string;
    campaignName: string;
    customer: { id: string; name: string; phone: string; stamps: number };
  } | null;
}>(() => `/api/merchant/last-stamp?campaignId=${campaignId.value || ""}`, {
  watch: [campaignId],
});

const staffName = computed(() => staffState.value?.current?.name || null);
const staffRequired = computed(() => Boolean(staffState.value?.required));
const counterReady = computed(() => !staffRequired.value || Boolean(staffName.value));
const undoable = computed(() => lastStamp.value?.undoable || null);

function fillPhone(next: string, nextCampaignId?: string) {
  if (nextCampaignId) campaignId.value = nextCampaignId;
  entryMode.value = "phone";
  phone.value = next;
  showCode.value = "";
  needName.value = false;
  error.value = "";
  message.value = "";
  verified.value = false;
}

async function onStaffUnlocked() {
  await refreshStaff();
}
async function onStaffLocked() {
  await refreshStaff();
}

async function onScanned(code: string) {
  scanning.value = false;
  entryMode.value = "show";
  showCode.value = code;
  await stamp();
}

async function stamp() {
  if (!campaignId.value) {
    error.value = "Select a campaign first";
    return;
  }
  error.value = "";
  message.value = "";
  loading.value = true;
  try {
    const res = await $fetch<{
      customer: Customer;
      canRedeem: boolean;
      rewardLabel: string;
      verified?: boolean;
      amount?: number;
      doubleStamp?: boolean;
      birthdayBonus?: boolean;
    }>("/api/merchant/stamp", {
      method: "POST",
      body:
        entryMode.value === "show"
          ? { campaignId: campaignId.value, showCode: showCode.value, amount: amount.value }
          : {
              campaignId: campaignId.value,
              phone: phone.value,
              name: needName.value ? name.value : undefined,
              amount: amount.value,
            },
    });
    needName.value = false;
    customer.value = res.customer;
    verified.value = Boolean(res.verified);
    phone.value = res.customer.phone;
    showCode.value = "";
    playStampFeedback();
    const extras = [
      res.doubleStamp ? "double day" : "",
      res.birthdayBonus ? "birthday bonus" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    message.value = res.canRedeem
      ? `+${res.amount ?? 1}${extras ? ` (${extras})` : ""}. ${res.customer.name} can ${copy.value.redeemAction.toLowerCase()} ${res.rewardLabel}.`
      : `+${res.amount ?? 1}${extras ? ` (${extras})` : ""}. ${res.customer.name} now has ${res.customer.stamps}.`;
    await Promise.all([refresh(), refreshLastStamp()]);
  } catch (e: unknown) {
    const err = e as {
      data?: { statusMessage?: string; data?: { code?: string } };
      statusMessage?: string;
    };
    if (err?.data?.data?.code === "STAFF_PIN_REQUIRED") {
      error.value = "Staff PIN required — unlock first.";
      await refreshStaff();
    } else if (err?.data?.data?.code === "NAME_REQUIRED" || err?.data?.statusMessage?.includes("name")) {
      needName.value = true;
      entryMode.value = "phone";
      error.value = "New customer — add a name, then try again.";
    } else {
      error.value = err?.data?.statusMessage || err?.statusMessage || "Failed";
    }
  } finally {
    loading.value = false;
  }
}

async function toggleDoubleStamp() {
  if (!selected.value) return;
  promoLoading.value = true;
  error.value = "";
  try {
    await $fetch("/api/merchant/promo", {
      method: "PATCH",
      body: { campaignId: selected.value.id, doubleStamp: !selected.value.doubleActive },
    });
    await refresh();
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    error.value = err?.data?.statusMessage || err?.statusMessage || "Could not toggle promo";
  } finally {
    promoLoading.value = false;
  }
}

async function redeem() {
  if (!customer.value || !campaignId.value) return;
  error.value = "";
  message.value = "";
  loading.value = true;
  try {
    const body =
      entryMode.value === "show" && showCode.value.trim()
        ? { campaignId: campaignId.value, showCode: showCode.value }
        : { campaignId: campaignId.value, phone: customer.value.phone };

    const res = await $fetch<{
      customer: Customer;
      rewardLabel: string;
      verified?: boolean;
    }>("/api/merchant/redeem", {
      method: "POST",
      body,
    });
    customer.value = res.customer;
    verified.value = Boolean(res.verified) || verified.value;
    showCode.value = "";
    message.value = `${copy.value.redeemAction}: ${res.rewardLabel}`;
    await Promise.all([refresh(), refreshLastStamp()]);
  } catch (e: unknown) {
    const err = e as {
      data?: { statusMessage?: string; data?: { code?: string } };
      statusMessage?: string;
    };
    if (err?.data?.data?.code === "STAFF_PIN_REQUIRED") {
      error.value = "Staff PIN required — unlock first.";
      await refreshStaff();
    } else {
      error.value = err?.data?.statusMessage || err?.statusMessage || "Redeem failed";
    }
  } finally {
    loading.value = false;
  }
}

async function undoLast() {
  if (!undoable.value) return;
  error.value = "";
  message.value = "";
  undoing.value = true;
  try {
    const res = await $fetch<{
      undone: { amount: number };
      customer: Customer;
    }>("/api/merchant/undo", {
      method: "POST",
      query: { campaignId: campaignId.value },
    });
    customer.value = res.customer;
    message.value = `Undid ${res.undone.amount} for ${res.customer.name}.`;
    await Promise.all([refresh(), refreshLastStamp()]);
  } catch (e: unknown) {
    const err = e as {
      data?: { statusMessage?: string; data?: { code?: string } };
      statusMessage?: string;
    };
    if (err?.data?.data?.code === "STAFF_PIN_REQUIRED") {
      error.value = "Staff PIN required — unlock first.";
      await refreshStaff();
    } else {
      error.value = err?.data?.statusMessage || err?.statusMessage || "Undo failed";
    }
  } finally {
    undoing.value = false;
  }
}
</script>

<template>
  <main class="app-shell app-shell--tabs">
    <AppTopBar
      :title="data?.merchant.name || 'Counter'"
      :subtitle="`Counter · ${data?.user.name || ''}`"
      show-logout
    />

    <div class="app-body">
      <StaffPinGate
        :required="staffRequired"
        :staff-name="staffName"
        @unlocked="onStaffUnlocked"
        @locked="onStaffLocked"
      />

      <template v-if="counterReady">
        <div v-if="data?.campaigns?.length" class="campaign-picker">
          <button
            v-for="c in data.campaigns"
            :key="c.id"
            type="button"
            class="campaign-picker__btn"
            :class="{ 'campaign-picker__btn--on': c.id === campaignId }"
            @click="campaignId = c.id"
          >
            <strong>{{ c.name }}</strong>
            <span>{{ c.campaign.title }} · {{ c.goal }} → {{ c.rewardLabel }}</span>
          </button>
        </div>
        <p v-else class="error">No active campaigns — add one in Settings.</p>

        <div class="kpi-scroll hide-desktop">
          <div class="kpi">
            <span class="muted">Today</span>
            <strong>{{ data?.stats.stampsToday ?? 0 }}</strong>
          </div>
          <div class="kpi">
            <span class="muted">Redeems</span>
            <strong>{{ data?.stats.redeemsToday ?? 0 }}</strong>
          </div>
          <div class="kpi">
            <span class="muted">Week</span>
            <strong>{{ data?.stats.stampsWeek ?? 0 }}</strong>
          </div>
          <div class="kpi">
            <span class="muted">Ready</span>
            <strong>{{ data?.stats.readyCount }}</strong>
          </div>
        </div>

        <div class="kpi-row hide-mobile">
          <div class="kpi">
            <span class="muted">Progress today</span>
            <strong>{{ data?.stats.stampsToday ?? 0 }}</strong>
          </div>
          <div class="kpi">
            <span class="muted">Redeems today</span>
            <strong>{{ data?.stats.redeemsToday ?? 0 }}</strong>
          </div>
          <div class="kpi">
            <span class="muted">This week</span>
            <strong>{{ data?.stats.stampsWeek ?? 0 }}</strong>
          </div>
          <div class="kpi">
            <span class="muted">New customers</span>
            <strong>{{ data?.stats.newCustomersWeek ?? 0 }}</strong>
          </div>
          <div class="kpi">
            <span class="muted">Ready</span>
            <strong>{{ data?.stats.readyCount }}</strong>
          </div>
          <div class="kpi">
            <span class="muted">Customers</span>
            <strong>{{ data?.stats.customerCount }}</strong>
          </div>
        </div>

        <div v-if="selected && can('doubleDay')" class="promo-toggle panel panel--compact">
          <div>
            <strong>{{ copy.doubleLabel }}</strong>
            <p class="muted" style="margin: 0.15rem 0 0">
              {{ selected.name }} ·
              {{ selected.doubleActive ? "On — counts ×2" : "Off" }}
            </p>
          </div>
          <button
            class="btn"
            :class="selected.doubleActive ? 'btn--primary' : 'btn--secondary'"
            type="button"
            :disabled="promoLoading"
            @click="toggleDoubleStamp"
          >
            {{ selected.doubleActive ? "Turn off" : "Turn on" }}
          </button>
        </div>

        <div class="grid-2">
          <section class="panel">
            <h1 style="margin-top: 0; font-size: 1.35rem">{{ copy.addAction }}</h1>
            <p class="muted" style="margin-top: 0">
              Campaign: <strong>{{ selected?.name || "—" }}</strong>. Scan QR or type show code.
            </p>

            <button
              v-if="can('qrScan')"
              class="btn btn--primary btn--block"
              type="button"
              style="margin-bottom: 0.85rem"
              :disabled="!selected"
              @click="scanning = true"
            >
              Scan show-code QR
            </button>

            <div class="mode-toggle" role="group" aria-label="Entry mode">
              <button
                type="button"
                class="mode-toggle__btn"
                :class="{ 'mode-toggle__btn--on': entryMode === 'show' }"
                @click="entryMode = 'show'"
              >
                Show code
              </button>
              <button
                type="button"
                class="mode-toggle__btn"
                :class="{ 'mode-toggle__btn--on': entryMode === 'phone' }"
                @click="entryMode = 'phone'"
              >
                New / phone
              </button>
            </div>

            <form @submit.prevent="stamp">
              <div v-if="entryMode === 'show'" class="field">
                <label for="showCode">Show code from buyer phone</label>
                <input
                  id="showCode"
                  v-model="showCode"
                  required
                  inputmode="numeric"
                  pattern="[0-9]*"
                  maxlength="4"
                  placeholder="4821"
                  class="show-code-input"
                />
              </div>
              <template v-else>
                <div class="field">
                  <label for="phone">Phone</label>
                  <input id="phone" v-model="phone" required placeholder="60123456789" inputmode="tel" />
                </div>
                <div v-if="needName" class="field">
                  <label for="name">Customer name</label>
                  <input id="name" v-model="name" required placeholder="Aina" />
                </div>
              </template>
              <div class="field">
                <label for="amount">{{ copy.progressLabel }} to add</label>
                <input id="amount" v-model.number="amount" type="number" min="1" max="10" />
              </div>
              <p v-if="error" class="error">{{ error }}</p>
              <p v-if="message" class="success">{{ message }}</p>

              <div v-if="undoable && can('undoStamp')" class="undo-bar">
                <span>
                  Last: +{{ undoable.amount }}
                  <strong>{{ undoable.customer.name }}</strong>
                  <span class="muted"> · {{ undoable.campaignName }}</span>
                </span>
                <button
                  class="btn btn--ghost btn--compact"
                  type="button"
                  :disabled="undoing || loading"
                  @click="undoLast"
                >
                  {{ undoing ? "Undoing…" : "Undo" }}
                </button>
              </div>

              <div class="sticky-actions">
                <div class="cta-row">
                  <button class="btn btn--primary" type="submit" :disabled="loading || !selected">
                    {{ loading ? "Working…" : copy.addAction }}
                  </button>
                  <button
                    v-if="customer && selected && customer.stamps >= selected.goal"
                    class="btn btn--secondary"
                    type="button"
                    :disabled="loading"
                    @click="redeem"
                  >
                    {{ copy.redeemAction }}
                  </button>
                </div>
              </div>
            </form>

            <div v-if="customer && selected" style="margin-top: 1.1rem">
              <p v-if="verified" class="pill pill--ready" style="margin: 0 0 0.55rem">
                Verified with show code
              </p>
              <StampCard
                :customer-name="customer.name"
                :stamps="customer.stamps"
                :stamp-goal="selected.goal"
                :reward-label="selected.rewardLabel"
                :campaign-type="selected.type"
                :brand-color="selected.brandColor || data?.merchant.brandColor"
                :logo-url="data?.merchant.logoUrl"
                :shop-name="selected.name"
                :reward-image-url="selected.rewardImageUrl"
                :card-theme="data?.merchant.cardTheme"
                :font-family="data?.merchant.fontFamily"
              />
            </div>
          </section>

          <div>
            <section v-if="data?.almostThere?.length" class="panel">
              <h2 style="margin-top: 0; font-size: 1.15rem">Almost there</h2>
              <ul class="almost-list">
                <li v-for="c in data.almostThere" :key="`${c.id}-${c.campaignId}`">
                  <button
                    class="almost-list__btn"
                    type="button"
                    @click="fillPhone(c.phone, c.campaignId)"
                  >
                    <span>
                      <strong>{{ c.name }}</strong>
                      <span class="muted"> · {{ c.campaignName }}</span>
                    </span>
                    <span class="almost-list__stamps">{{ c.stamps }}/{{ c.stampGoal }}</span>
                  </button>
                </li>
              </ul>
            </section>

            <section class="panel">
              <h2 style="margin-top: 0; font-size: 1.15rem">Recent</h2>
              <p v-if="!data?.recent?.length" class="muted">No customers yet.</p>
              <ul v-else class="person-list">
                <li v-for="c in data.recent" :key="c.id">
                  <button class="almost-list__btn" type="button" @click="fillPhone(c.phone)">
                    <span>
                      <strong>{{ c.name }}</strong>
                      <div class="person-card__meta">{{ c.phone }}</div>
                    </span>
                    <span class="almost-list__stamps">{{ c.stamps }}</span>
                  </button>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </template>
    </div>

    <ShowCodeScanner
      v-if="scanning && counterReady && can('qrScan')"
      @scanned="onScanned"
      @close="scanning = false"
    />

    <MerchantTabBar />
  </main>
</template>
