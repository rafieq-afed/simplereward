function digitsOnly(phone: string) {
  return String(phone || "").replace(/\D/g, "");
}

function getWhatsAppConfig() {
  const config = useRuntimeConfig();
  return {
    token: (config.whatsappToken || process.env.WHATSAPP_TOKEN || "") as string,
    phoneNumberId: (config.whatsappPhoneNumberId ||
      process.env.WHATSAPP_PHONE_NUMBER_ID ||
      "") as string,
    almostTemplate: (config.whatsappAlmostTemplate ||
      process.env.WHATSAPP_TEMPLATE_ALMOST ||
      "") as string,
  };
}

export function whatsappConfigured() {
  const c = getWhatsAppConfig();
  return Boolean(c.token && c.phoneNumberId);
}

async function sendWhatsAppText(phone: string, bodyText: string) {
  const { token, phoneNumberId } = getWhatsAppConfig();
  if (!token || !phoneNumberId) {
    return { sent: false as const, reason: "not_configured" as const };
  }

  const to = digitsOnly(phone);
  if (to.length < 8) {
    return { sent: false as const, reason: "bad_phone" as const };
  }

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: bodyText },
      }),
    });
    if (!res.ok) {
      console.error("[whatsapp:error]", res.status, await res.text());
      return { sent: false as const, reason: "api_error" as const };
    }
    return { sent: true as const };
  } catch (e) {
    console.error("[whatsapp:error]", e);
    return { sent: false as const, reason: "network" as const };
  }
}

type AlmostTherePayload = {
  phone: string;
  customerName: string;
  shopName: string;
  stamps: number;
  stampGoal: number;
  rewardLabel: string;
  cardUrl: string;
};

/** Send "1 stamp away" WhatsApp if Cloud API is configured; otherwise no-op. */
export async function maybeSendAlmostThereWhatsApp(payload: AlmostTherePayload) {
  const { token, phoneNumberId, almostTemplate } = getWhatsAppConfig();
  if (!token || !phoneNumberId) {
    if (import.meta.dev) {
      console.info(
        `[whatsapp:skip] ${payload.customerName} almost there at ${payload.shopName} (${payload.stamps}/${payload.stampGoal})`,
      );
    }
    return { sent: false as const, reason: "not_configured" as const };
  }

  const remaining = payload.stampGoal - payload.stamps;
  const bodyText = `${payload.shopName}: Hi ${payload.customerName}! ${remaining} stamp${remaining === 1 ? "" : "s"} to go for ${payload.rewardLabel}. ${payload.cardUrl}`;

  if (!almostTemplate) {
    return sendWhatsAppText(payload.phone, bodyText);
  }

  const to = digitsOnly(payload.phone);
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: almostTemplate,
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: payload.customerName },
                { type: "text", text: String(remaining) },
                { type: "text", text: payload.rewardLabel },
                { type: "text", text: payload.shopName },
              ],
            },
          ],
        },
      }),
    });
    if (!res.ok) {
      console.error("[whatsapp:error]", res.status, await res.text());
      return { sent: false as const, reason: "api_error" as const };
    }
    return { sent: true as const };
  } catch (e) {
    console.error("[whatsapp:error]", e);
    return { sent: false as const, reason: "network" as const };
  }
}

export async function maybeSendOtpWhatsApp(phone: string, shopName: string, code: string) {
  const body = `${shopName}: Your join code is ${code}. Valid 10 minutes.`;
  const result = await sendWhatsAppText(phone, body);
  if (!result.sent && result.reason === "not_configured" && import.meta.dev) {
    console.info(`[whatsapp:otp] ${phone} → ${code}`);
  }
  return result;
}

export async function maybeSendInactiveBlast(payload: {
  phone: string;
  customerName: string;
  shopName: string;
  cardUrl: string;
  rewardLabel: string;
}) {
  const body = `${payload.shopName}: Hi ${payload.customerName}, we miss you! Your stamp card is waiting — come by for ${payload.rewardLabel}. ${payload.cardUrl}`;
  const result = await sendWhatsAppText(payload.phone, body);
  if (!result.sent && result.reason === "not_configured" && import.meta.dev) {
    console.info(`[whatsapp:blast] ${payload.customerName} (${payload.phone})`);
  }
  return result;
}
