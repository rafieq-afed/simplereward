export default defineNuxtRouteMiddleware(async (to) => {
  const needsAdmin = to.path.startsWith("/admin");
  const needsMerchant = to.path.startsWith("/merchant");
  if (!needsAdmin && !needsMerchant) return;

  try {
    const data = await $fetch<{
      user: { role: string; merchantId?: string | null };
    }>("/api/auth/me");
    if (needsAdmin && data.user.role !== "ADMIN") {
      return navigateTo("/merchant");
    }
    if (needsMerchant && data.user.role !== "MERCHANT") {
      return navigateTo("/admin");
    }

    if (
      needsMerchant &&
      data.user.role === "MERCHANT" &&
      !to.path.startsWith("/merchant/onboarding")
    ) {
      const dash = await $fetch<{ merchant: { onboardedAt?: string | null } }>(
        "/api/merchant/dashboard",
      );
      if (!dash.merchant.onboardedAt) {
        return navigateTo("/merchant/onboarding");
      }
    }
  } catch {
    return navigateTo("/login");
  }
});

