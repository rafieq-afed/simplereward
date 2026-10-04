<script setup lang="ts">
const route = useRoute();

const tabs = [
  { to: "/merchant", label: "Counter", match: /^\/merchant\/?$/ },
  { to: "/merchant/customers", label: "Customers", match: /^\/merchant\/customers/ },
  { to: "/merchant/settings", label: "Settings", match: /^\/merchant\/settings/ },
] as const;

function active(match: RegExp) {
  return match.test(route.path);
}
</script>

<template>
  <nav class="tab-bar" aria-label="Merchant">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="tab-bar__item"
      :class="{ 'tab-bar__item--active': active(tab.match) }"
    >
      <span class="tab-bar__icon" aria-hidden="true">
        <svg v-if="tab.to === '/merchant'" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8" />
          <path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        <svg v-else-if="tab.to === '/merchant/customers'" viewBox="0 0 24 24" fill="none">
          <circle cx="9" cy="9" r="3.2" stroke="currentColor" stroke-width="1.8" />
          <path
            d="M4.5 18.5c.8-2.6 2.8-4 4.5-4s3.7 1.4 4.5 4"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
          <circle cx="16.5" cy="9.5" r="2.4" stroke="currentColor" stroke-width="1.8" />
          <path
            d="M15 14.2c1.5.3 2.8 1.3 3.5 3.3"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none">
          <path
            d="M12 4.5l1.7 3.5 3.8.6-2.8 2.7.7 3.8L12 13.5 8.6 15.1l.7-3.8-2.8-2.7 3.8-.6L12 4.5z"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
          <rect x="5" y="16.5" width="14" height="3" rx="1.2" stroke="currentColor" stroke-width="1.6" />
        </svg>
      </span>
      <span>{{ tab.label }}</span>
    </NuxtLink>
  </nav>
</template>
