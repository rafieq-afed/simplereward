<script setup lang="ts">
import { campaignCopy, type CampaignType } from "#shared/campaign";
import {
  fontCss,
  fontGoogleHref,
  normalizeCardTheme,
  type CardTheme,
} from "#shared/brand";

const props = defineProps<{
  stamps: number;
  stampGoal: number;
  rewardLabel: string;
  customerName?: string;
  campaignType?: CampaignType | string | null;
  brandColor?: string | null;
  logoUrl?: string | null;
  shopName?: string;
  rewardImageUrl?: string | null;
  cardTheme?: CardTheme | string | null;
  fontFamily?: string | null;
}>();

const copy = computed(() => campaignCopy(props.campaignType));
const theme = computed(() => normalizeCardTheme(props.cardTheme));

const slots = computed(() =>
  Array.from({ length: props.stampGoal }, (_, i) => i < props.stamps),
);
const cols = computed(() => Math.min(props.stampGoal, 5));
const left = computed(() => Math.max(0, props.stampGoal - props.stamps));
const almostThere = computed(() => left.value > 0 && left.value <= 2);

const themeStyle = computed(() => {
  const color = props.brandColor || "#1f7a57";
  return {
    "--card-brand": color,
    "--card-font": fontCss(props.fontFamily),
  } as Record<string, string>;
});

const fontHref = computed(() => fontGoogleHref(props.fontFamily));

useHead(() =>
  fontHref.value
    ? {
        link: [
          { rel: "preconnect", href: "https://fonts.googleapis.com" },
          { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
          { rel: "stylesheet", href: fontHref.value },
        ],
      }
    : {},
);
</script>

<template>
  <div
    class="stamp-card"
    :class="[
      `stamp-card--${theme}`,
      { 'stamp-card--almost': almostThere },
    ]"
    :style="themeStyle"
  >
    <div v-if="logoUrl || shopName" class="stamp-card__brand">
      <img v-if="logoUrl" :src="logoUrl" :alt="shopName || 'Shop'" class="stamp-card__logo" />
      <span v-if="shopName" class="stamp-card__shop">{{ shopName }}</span>
      <span class="stamp-card__type">{{ copy.title }}</span>
    </div>

    <div v-if="rewardImageUrl" class="stamp-card__reward-media">
      <img :src="rewardImageUrl" :alt="rewardLabel" />
    </div>

    <p v-if="customerName" class="stamp-card__hello">Hi, {{ customerName }}</p>
    <p class="stamp-card__meta">
      {{ Math.min(stamps, stampGoal) }} / {{ stampGoal }} {{ copy.unitPlural }} ·
      {{ rewardLabel }}
    </p>
    <div
      class="stamp-grid"
      :style="{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }"
    >
      <div
        v-for="(filled, index) in slots"
        :key="index"
        class="stamp-slot"
        :class="{ 'stamp-slot--filled': filled }"
        :aria-label="filled ? 'Filled' : 'Empty'"
      >
        {{ filled ? "●" : "○" }}
      </div>
    </div>
    <p v-if="stamps >= stampGoal" class="stamp-card__ready">{{ copy.readyLabel }}</p>
    <p v-else-if="almostThere" class="stamp-card__almost">
      Almost there — {{ left }} more for {{ rewardLabel.toLowerCase() }}
    </p>
    <p v-else class="stamp-card__left">
      {{ left }} more {{ left === 1 ? copy.unitSingular : copy.unitPlural }} for
      {{ rewardLabel.toLowerCase() }}
    </p>
  </div>
</template>
