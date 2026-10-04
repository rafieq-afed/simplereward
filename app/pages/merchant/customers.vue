<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const { data: dash, refresh: refreshDash } = await useFetch<{
  merchant: { name: string; stampGoal: number };
  plan?: { features: Record<string, boolean> };
  stats: { inactiveCount: number };
}>("/api/merchant/dashboard");

function can(feature: string) {
  return Boolean(dash.value?.plan?.features?.[feature]);
}

const q = ref("");
const debouncedQ = ref("");
const blastMsg = ref("");
const blastLoading = ref(false);

let searchTimer: number | undefined;
watch(q, (value) => {
  if (searchTimer) window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    debouncedQ.value = value;
  }, 250);
});

const { data, status } = await useFetch<{
  customers: {
    id: string;
    name: string;
    phone: string;
    stamps: number;
    totalRedeemed: number;
    birthdayMd?: string | null;
    enrollments?: {
      campaignId: string;
      campaignName: string;
      progress: number;
      goal: number;
    }[];
  }[];
}>("/api/merchant/customers", {
  query: computed(() => ({ q: debouncedQ.value || undefined })),
  watch: [debouncedQ],
});

async function blastInactive() {
  blastMsg.value = "";
  blastLoading.value = true;
  try {
    const res = await $fetch<{ message: string }>("/api/merchant/blast-inactive", {
      method: "POST",
      body: { days: 14 },
    });
    blastMsg.value = res.message;
    await refreshDash();
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    blastMsg.value = err?.data?.statusMessage || err?.statusMessage || "Blast failed";
  } finally {
    blastLoading.value = false;
  }
}
</script>

<template>
  <main class="app-shell app-shell--tabs">
    <AppTopBar :title="dash?.merchant.name || 'Customers'" subtitle="Customers" show-logout />

    <div class="app-body">
      <section class="panel">
        <div class="customers-toolbar">
          <div class="field" style="margin: 0; flex: 1">
            <label for="q">Search</label>
            <input
              id="q"
              v-model="q"
              placeholder="Name or phone"
              autocomplete="off"
            />
          </div>
          <a
            v-if="can('csvExport')"
            class="btn btn--secondary"
            href="/api/merchant/customers/export"
          >
            Export CSV
          </a>
        </div>

        <div v-if="can('whatsappBlast')" class="blast-box">
          <div>
            <strong>Win back quiet customers</strong>
            <p class="muted" style="margin: 0.2rem 0 0">
              {{ dash?.stats.inactiveCount ?? 0 }} inactive 14+ days — WhatsApp nudge (max 50).
            </p>
          </div>
          <button
            class="btn btn--primary"
            type="button"
            :disabled="blastLoading || !(dash?.stats.inactiveCount)"
            @click="blastInactive"
          >
            {{ blastLoading ? "Sending…" : "Blast inactive" }}
          </button>
        </div>
        <p v-if="blastMsg" class="success" style="margin-top: 0.65rem">{{ blastMsg }}</p>

        <p v-if="status === 'pending'" class="muted">Loading…</p>
        <p v-else-if="!data?.customers?.length" class="muted">No customers yet.</p>

        <ul v-else class="person-list hide-desktop">
          <li v-for="c in data.customers" :key="c.id" class="person-card">
            <div class="person-card__row">
              <strong>{{ c.name }}</strong>
              <span>
                {{ c.stamps }}/{{ dash?.merchant.stampGoal }}
                <span
                  v-if="dash && c.stamps >= dash.merchant.stampGoal"
                  class="pill pill--ready"
                >
                  Ready
                </span>
                <span
                  v-else-if="dash && c.stamps >= dash.merchant.stampGoal - 2"
                  class="pill pill--almost"
                >
                  Close
                </span>
              </span>
            </div>
            <div class="person-card__meta">{{ c.phone }}</div>
            <div class="person-card__meta">
              Redeemed {{ c.totalRedeemed }}×
              <span v-if="c.birthdayMd"> · Birthday {{ c.birthdayMd }}</span>
            </div>
            <div v-if="c.enrollments?.length" class="person-card__meta">
              <span v-for="e in c.enrollments" :key="e.campaignId" style="margin-right: 0.55rem">
                {{ e.campaignName }} {{ e.progress }}/{{ e.goal }}
              </span>
            </div>
          </li>
        </ul>

        <div v-if="data?.customers?.length" class="table-wrap hide-mobile">
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Stamps</th>
                <th>Redeemed</th>
                <th>Birthday</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in data.customers" :key="c.id">
                <td>{{ c.name }}</td>
                <td>{{ c.phone }}</td>
                <td>
                  {{ c.stamps }}/{{ dash?.merchant.stampGoal }}
                  <span
                    v-if="dash && c.stamps >= dash.merchant.stampGoal"
                    class="pill pill--ready"
                  >
                    Ready
                  </span>
                  <span
                    v-else-if="dash && c.stamps >= dash.merchant.stampGoal - 2"
                    class="pill pill--almost"
                  >
                    Close
                  </span>
                </td>
                <td>{{ c.totalRedeemed }}</td>
                <td>{{ c.birthdayMd || "—" }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <MerchantTabBar />
  </main>
</template>
