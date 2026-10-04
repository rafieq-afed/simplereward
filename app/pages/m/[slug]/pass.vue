<script setup lang="ts">
const route = useRoute();
const slug = computed(() => String(route.params.slug));
const phone = computed(() => String(route.query.phone || ""));

const { data: shop } = await useFetch(() => `/api/public/${slug.value}`);

const { data, error } = await useFetch(() => `/api/public/${slug.value}/card`, {
  query: computed(() => ({ phone: phone.value })),
  immediate: Boolean(phone.value),
});

const cardUrl = computed(() => {
  if (!import.meta.client) return "";
  return `${window.location.origin}/m/${slug.value}`;
});

async function copyLink() {
  try {
    await navigator.clipboard.writeText(`${cardUrl.value}?phone=${encodeURIComponent(phone.value)}`);
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <main class="app-shell app-shell--customer">
    <div class="customer-screen">
      <div class="customer-screen__top">
        <div class="customer-screen__bar">
          <NuxtLink :to="`/m/${slug}`" class="customer-screen__mark">Stamp</NuxtLink>
          <NuxtLink :to="`/m/${slug}`" class="customer-screen__home">Back</NuxtLink>
        </div>
        <h1>Wallet pass</h1>
        <p>Keep this card on your phone — Add to Home Screen, or bookmark the link.</p>
      </div>

      <div class="customer-sheet">
        <p v-if="!phone" class="panel error">Open your card first, then tap Open wallet pass.</p>
        <p v-else-if="error" class="panel error">Could not load card for this phone.</p>

        <div v-else-if="data?.customer && shop?.merchant" class="wallet-pass">
          <p class="wallet-pass__shop">{{ shop.merchant.name }}</p>
          <p class="wallet-pass__name">{{ data.customer.name }}</p>
          <p class="wallet-pass__meta">
            {{ data.customer.stamps }} / {{ shop.merchant.stampGoal }} ·
            {{ shop.merchant.rewardLabel }}
          </p>
          <p class="wallet-pass__code">Card {{ data.customer.cardCode || "—" }}</p>
          <StampCard
            :customer-name="data.customer.name"
            :stamps="data.customer.stamps"
            :stamp-goal="shop.merchant.stampGoal"
            :reward-label="shop.merchant.rewardLabel"
            :campaign-type="shop.merchant.campaignType"
            :brand-color="shop.merchant.brandColor"
            :logo-url="shop.merchant.logoUrl"
            :shop-name="shop.merchant.name"
          />
          <InstallHint />
          <div class="cta-row cta-row--stack" style="margin-top: 1rem">
            <NuxtLink class="btn btn--primary" :to="`/m/${slug}`">Open live card</NuxtLink>
            <button class="btn btn--secondary" type="button" @click="copyLink">
              Copy card link
            </button>
          </div>
          <p class="muted" style="margin-top: 0.85rem; font-size: 0.85rem">
            Apple/Google Wallet signed passes need shop certificates — this wallet-lite pass works
            everywhere via Home Screen.
          </p>
        </div>
      </div>
    </div>
  </main>
</template>
