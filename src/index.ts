import { ApiException, fromHono } from "chanfana";
import { Hono } from "hono";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { TestEndpoint } from "./endpoints/test";
import { WebhookDopplerEndpoint } from "./endpoints/webhookDoppler";
import { WebhookGithubEndpoint } from "./endpoints/webhookGithub";

// ==================== HONO APP ====================
const app = new Hono<{ Bindings: Env }>();

// Global error handler
app.onError((err, c) => {
  if (err instanceof ApiException) {
    return c.json(
      { success: false, errors: err.buildResponse() },
      err.status as ContentfulStatusCode,
    );
  }

  console.error("Global error handler caught:", err);

  return c.json(
    {
      success: false,
      errors: [{ code: 7000, message: "Internal Server Error" }],
    },
    500,
  );
});

// ==================== OPENAPI REGISTRY ====================
const openapi = fromHono(app, {
  docs_url: "/",
  schema: {
    info: {
      title: "GitHub & Doppler Webhook to Telegram API",
      version: "1.1.0",
      description: `
Settings được quản lý thủ công trong Cloudflare D1 Database:
- \`WEBHOOK_GITHUB_SECRET\` - GitHub webhook secret (HMAC-SHA256)
- \`WEBHOOK_DOPPLER_SECRET\` - Doppler webhook secret (Bearer token)
- \`TELEGRAM_BOT_TOKEN\` - Telegram bot token
- \`TELEGRAM_CHAT_ID_GITHUB\` - Telegram chat ID cho GitHub notifications
- \`TELEGRAM_CHAT_ID_DOPPLER\` - Telegram chat ID cho Doppler notifications
      `,
    },
  },
});

// ==================== REGISTER ROUTES ====================

// GitHub Webhook (POST /webhook)
openapi.post("/webhook/github", WebhookGithubEndpoint);

// Doppler Webhook (POST /webhook/doppler)
openapi.post("/webhook/doppler", WebhookDopplerEndpoint);

// Test endpoint (POST /api/test)
openapi.post("/api/test", TestEndpoint);

// ==================== EXPORT ====================
export default app;
