<script setup lang="ts">
import {
  FEATURE_CATALOG,
  TIER_TEMPLATES,
  emptyFeatures,
  featuresFromTier,
  priceFor,
  type FeatureKey,
  type TierId,
} from "#shared/features";

definePageMeta({ middleware: "auth" });

type MerchantRow = {
  id: string;
  name: string;
  slug: string;
  stampGoal: number;
  rewardLabel: string;
  features: Record<FeatureKey, boolean>;
  quotedPrice: number;
  enabledCount: number;
  pendingUpgrades: number;
  _count: { customers: number };
  users: { email: string; name: string }[];
};

type UpgradeReq = {
  id: string;
  message: string | null;
  desiredTier: string | null;
  status: string;
  createdAt: string;
  merchant: {
    id: string;
    name: string;
    slug: string;
    quotedPrice: number;
    enabledCount: number;
  };
};

const { data, refresh } = await useFetch<{
  merchants: MerchantRow[];
  catalog: typeof FEATURE_CATALOG;
  templates: { id: TierId; label: string; blurb: string; suggestedPrice: number }[];
}>("/api/admin/merchants");

const { data: upgradeData, refresh: refreshUpgrades } = await useFetch<{
  requests: UpgradeReq[];
}>("/api/admin/upgrade-requests");

const me = await useFetch<{ user: { name: string } }>("/api/auth/me");

const form = reactive({
  name: "",
  slug: "",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
  stampGoal: 10,
  rewardLabel: "Free cookie or coffee",
});
const error = ref("");
const ok = ref("");
const loading = ref(false);

const editingId = ref<string | null>(null);
const draft = ref<Record<FeatureKey, boolean>>(emptyFeatures());
const featError = ref("");
const featOk = ref("");
const featLoading = ref(false);

const livePrice = computed(() => priceFor(draft.value));
const editingMerchant = computed(
  () => data.value?.merchants.find((m) => m.id === editingId.value) || null,
);

function openFeatures(m: MerchantRow) {
  editingId.value = m.id;
  draft.value = { ...emptyFeatures(), ...m.features };
  featError.value = "";
  featOk.value = "";
}

function applyTier(tier: TierId) {
  draft.value = featuresFromTier(tier);
}

function toggleFeature(key: FeatureKey) {
  draft.value = { ...draft.value, [key]: !draft.value[key] };
}

async function saveFeatures() {
  if (!editingId.value) return;
  featError.value = "";
  featOk.value = "";
  featLoading.value = true;
  try {
    await $fetch(`/api/admin/merchants/${editingId.value}/features`, {
      method: "PATCH",
      body: { features: draft.value },
    });
    featOk.value = `Saved · RM ${livePrice.value}/mo`;
    await refresh();
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    featError.value = err?.data?.statusMessage || err?.statusMessage || "Could not save";
  } finally {
    featLoading.value = false;
  }
}

async function resolveRequest(
  req: UpgradeReq,
  status: "DONE" | "REJECTED",
  applyTier?: TierId,
) {
  try {
    await $fetch(`/api/admin/upgrade-requests/${req.id}`, {
      method: "PATCH",
      body: { status, applyTier },
    });
    await Promise.all([refreshUpgrades(), refresh()]);
    if (status === "DONE" && !applyTier) {
      const m = data.value?.merchants.find((x) => x.id === req.merchant.id);
      if (m) openFeatures(m);
    }
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    featError.value = err?.data?.statusMessage || err?.statusMessage || "Could not update request";
  }
}

async function createMerchant() {
  error.value = "";
  ok.value = "";
  loading.value = true;
  try {
    const res = await $fetch<{ merchant: { name: string; slug: string } }>(
      "/api/admin/merchants",
      {
        method: "POST",
        body: {
          ...form,
          slug: form.slug || undefined,
        },
      },
    );
    ok.value = `Created ${res.merchant.name} (Starter). Card: /m/${res.merchant.slug}`;
    form.name = "";
    form.slug = "";
    form.ownerName = "";
    form.ownerEmail = "";
    form.ownerPassword = "";
    form.stampGoal = 10;
    form.rewardLabel = "Free cookie or coffee";
    await refresh();
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    error.value = err?.data?.statusMessage || err?.statusMessage || "Could not create merchant";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="app-shell app-shell--wide" style="padding-bottom: 2rem">
    <AppTopBar title="Stamp" :subtitle="`Admin · ${me.data.value?.user.name || ''}`" show-logout />

    <div class="app-body">
      <section v-if="upgradeData?.requests?.length" class="panel" style="margin-bottom: 1rem">
        <h2 style="margin-top: 0; font-size: 1.15rem">Upgrade requests</h2>
        <ul class="upgrade-list">
          <li v-for="r in upgradeData.requests" :key="r.id">
            <div>
              <strong>{{ r.merchant.name }}</strong>
              <div class="muted" style="font-size: 0.85rem">
                Wants {{ r.desiredTier || "custom" }}
                · now {{ r.merchant.enabledCount }} features · RM {{ r.merchant.quotedPrice }}
              </div>
              <p v-if="r.message" style="margin: 0.35rem 0 0; font-size: 0.9rem">
                {{ r.message }}
              </p>
            </div>
            <div class="cta-row" style="flex-wrap: wrap">
              <button
                class="btn btn--primary btn--compact"
                type="button"
                @click="resolveRequest(r, 'DONE', (r.desiredTier as TierId) || 'growth')"
              >
                Approve {{ r.desiredTier || "growth" }}
              </button>
              <button
                class="btn btn--secondary btn--compact"
                type="button"
                @click="resolveRequest(r, 'DONE')"
              >
                Edit features
              </button>
              <button
                class="btn btn--ghost btn--compact"
                type="button"
                @click="resolveRequest(r, 'REJECTED')"
              >
                Reject
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section class="panel" style="margin-bottom: 1rem">
        <h1 style="margin-top: 0; font-size: 1.35rem">Merchants</h1>
        <p class="muted" style="margin-top: 0">
          Tick features per shop. Tier buttons are templates only.
        </p>
        <p v-if="!data?.merchants?.length" class="muted">No merchants yet.</p>

        <ul v-else class="person-list hide-desktop">
          <li v-for="m in data.merchants" :key="m.id" class="person-card">
            <div class="person-card__row">
              <strong>{{ m.name }}</strong>
              <span>{{ m._count.customers }} cust.</span>
            </div>
            <div class="person-card__meta">
              {{ m.enabledCount }} features · RM {{ m.quotedPrice }}/mo
              <span v-if="m.pendingUpgrades"> · {{ m.pendingUpgrades }} request</span>
            </div>
            <div class="person-card__meta">
              {{ m.users[0]?.name || "—" }} · {{ m.users[0]?.email }}
            </div>
            <div class="cta-row" style="margin-top: 0.55rem">
              <button class="btn btn--secondary btn--compact" type="button" @click="openFeatures(m)">
                Edit features
              </button>
              <NuxtLink class="btn btn--ghost btn--compact" :to="`/m/${m.slug}`">
                /m/{{ m.slug }}
              </NuxtLink>
            </div>
          </li>
        </ul>

        <div v-if="data?.merchants?.length" class="table-wrap hide-mobile">
          <table class="table">
            <thead>
              <tr>
                <th>Shop</th>
                <th>Package</th>
                <th>Owner</th>
                <th>Cust.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in data.merchants" :key="m.id">
                <td>
                  <strong>{{ m.name }}</strong>
                  <div class="muted">
                    <NuxtLink :to="`/m/${m.slug}`">/m/{{ m.slug }}</NuxtLink>
                  </div>
                </td>
                <td>
                  {{ m.enabledCount }} features
                  <div class="muted">RM {{ m.quotedPrice }}/mo</div>
                  <div v-if="m.pendingUpgrades" class="muted">
                    {{ m.pendingUpgrades }} upgrade request
                  </div>
                </td>
                <td>
                  {{ m.users[0]?.name || "—" }}
                  <div class="muted">{{ m.users[0]?.email }}</div>
                </td>
                <td>{{ m._count.customers }}</td>
                <td>
                  <button
                    class="btn btn--secondary btn--compact"
                    type="button"
                    @click="openFeatures(m)"
                  >
                    Edit features
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="grid-2">
        <section v-if="editingMerchant" class="panel">
          <h2 style="margin-top: 0; font-size: 1.15rem">
            Features · {{ editingMerchant.name }}
          </h2>
          <p class="muted" style="margin-top: 0">
            Apply a tier as guidance, then tweak. Price updates as you tick.
          </p>

          <div class="tier-row">
            <button
              v-for="t in TIER_TEMPLATES"
              :key="t.id"
              type="button"
              class="btn btn--secondary btn--compact"
              @click="applyTier(t.id)"
            >
              {{ t.label }} · RM {{ priceFor(featuresFromTier(t.id)) }}
            </button>
          </div>

          <ul class="feature-check-list">
            <li v-for="f in FEATURE_CATALOG" :key="f.key">
              <label class="check-row" style="margin: 0">
                <input
                  type="checkbox"
                  :checked="draft[f.key]"
                  @change="toggleFeature(f.key)"
                />
                <span>
                  <strong>{{ f.label }}</strong>
                  <span class="muted"> — {{ f.blurb }}</span>
                </span>
              </label>
              <span class="feature-check-list__price">RM {{ f.price }}</span>
            </li>
          </ul>

          <p class="feature-total">
            Total <strong>RM {{ livePrice }}</strong
            ><span class="muted"> / month (quoted)</span>
          </p>
          <p v-if="featError" class="error">{{ featError }}</p>
          <p v-if="featOk" class="success">{{ featOk }}</p>
          <div class="cta-row">
            <button
              class="btn btn--primary"
              type="button"
              :disabled="featLoading"
              @click="saveFeatures"
            >
              {{ featLoading ? "Saving…" : "Save features" }}
            </button>
            <button class="btn btn--ghost" type="button" @click="editingId = null">
              Close
            </button>
          </div>
        </section>
        <section v-else class="panel hide-mobile">
          <h2 style="margin-top: 0; font-size: 1.15rem">Features</h2>
          <p class="muted" style="margin: 0">
            Select a shop and click <strong>Edit features</strong> to set permissions and price.
          </p>
        </section>

        <section class="panel">
          <h2 style="margin-top: 0; font-size: 1.15rem">Create merchant</h2>
          <p class="muted" style="margin-top: 0">Starts on Starter template.</p>
          <form @submit.prevent="createMerchant">
            <div class="field">
              <label for="name">Shop name</label>
              <input id="name" v-model="form.name" required placeholder="Cookie Cafe" />
            </div>
            <div class="field">
              <label for="slug">Slug (optional)</label>
              <input id="slug" v-model="form.slug" placeholder="cookie-cafe" />
            </div>
            <div class="field">
              <label for="ownerName">Owner name</label>
              <input id="ownerName" v-model="form.ownerName" required />
            </div>
            <div class="field">
              <label for="ownerEmail">Owner email</label>
              <input id="ownerEmail" v-model="form.ownerEmail" type="email" required />
            </div>
            <div class="field">
              <label for="ownerPassword">Owner password</label>
              <input
                id="ownerPassword"
                v-model="form.ownerPassword"
                type="password"
                required
                minlength="6"
              />
            </div>
            <div class="field">
              <label for="stampGoal">Stamps for reward</label>
              <input
                id="stampGoal"
                v-model.number="form.stampGoal"
                type="number"
                min="2"
                max="50"
              />
            </div>
            <div class="field">
              <label for="rewardLabel">Reward</label>
              <input id="rewardLabel" v-model="form.rewardLabel" />
            </div>
            <p v-if="error" class="error">{{ error }}</p>
            <p v-if="ok" class="success">{{ ok }}</p>
            <button class="btn btn--primary btn--block" type="submit" :disabled="loading">
              {{ loading ? "Creating…" : "Create merchant" }}
            </button>
          </form>
        </section>
      </div>
    </div>
  </main>
</template>
