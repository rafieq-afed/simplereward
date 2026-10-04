/** Redirect already-signed-in users away from login/signup. */
export default defineNuxtRouteMiddleware(async () => {
  try {
    const data = await $fetch<{ user: { role: string } }>("/api/auth/me");
    if (data.user.role === "ADMIN") {
      return navigateTo("/admin");
    }
    return navigateTo("/merchant");
  } catch {
    // stay on guest page
  }
});
