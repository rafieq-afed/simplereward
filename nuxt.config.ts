// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  css: ["~/assets/css/main.css"],
  devServer: {
    port: 3005,
  },
  runtimeConfig: {
    sessionSecret: process.env.SESSION_SECRET || "",
    whatsappToken: process.env.WHATSAPP_TOKEN || "",
    whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    whatsappAlmostTemplate: process.env.WHATSAPP_TEMPLATE_ALMOST || "",
  },
  app: {
    head: {
      title: "Stamp",
      htmlAttrs: { lang: "en" },
      meta: [
        {
          name: "description",
          content: "Simple stamp-card rewards for small shops.",
        },
        {
          name: "viewport",
          content:
            "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1",
        },
        { name: "theme-color", content: "#1f7a57" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "default" },
        { name: "apple-mobile-web-app-title", content: "Stamp" },
        { name: "mobile-web-app-capable", content: "yes" },
      ],
      link: [
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "apple-touch-icon", href: "/icon-192.png" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;700;800&family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;700&family=Space+Grotesk:wght@500;600;700&family=Syne:wght@600;700;800&display=swap",
        },
      ],
    },
  },
});
