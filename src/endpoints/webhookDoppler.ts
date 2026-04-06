import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { getSetting } from "../utils/database";
import { sendToTelegram } from "../utils/telegram";

// Doppler uses Bearer token auth via Authorization header
// Docs: https://docs.doppler.com/docs/webhooks

export class WebhookDopplerEndpoint extends OpenAPIRoute {
  public schema = {
    tags: ["Webhook"],
    summary: "Doppler Webhook Handler",
    description: `
Nhận webhook từ Doppler và gửi thông báo qua Telegram (Doppler chat).

Xác thực bằng header \`Authorization: Bearer <WEBHOOK_DOPPLER_SECRET>\`.

Hỗ trợ các events:
- **config.secrets.update**: Khi secrets thay đổi (added / updated / removed)
- Và các events khác từ Doppler
    `,
    operationId: "doppler-webhook",
    request: {
      headers: z.object({
        authorization: z.string().optional(),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.any().describe("Doppler webhook payload"),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Webhook processed successfully",
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean() }),
          },
        },
      },
      "401": {
        description: "Invalid token",
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean(), error: z.string() }),
          },
        },
      },
    },
  };

  public async handle(c: AppContext) {
    try {
      const authHeader = c.req.header("authorization") || "";
      const body = await c.req.text();

      // Verify Bearer token
      const secret = await getSetting(
        c.env.DB,
        "WEBHOOK_DOPPLER_SECRET",
        c.env,
      );
      const token = authHeader.replace("Bearer ", "").trim();

      if (!token || token !== secret) {
        return c.json(
          { success: false, error: "Unauthorized: Invalid Token" },
          401,
        );
      }

      const payload = JSON.parse(body);
      const eventType: string = payload.type || "unknown";

      let message = "";

      // config.secrets.update
      if (eventType === "config.secrets.update") {
        const config = payload.config;
        const project = payload.project;
        const workplace = payload.workplace;
        const diff = payload.diff;
        const webhook = payload.webhook;

        const added: string[] = diff?.added || [];
        const updated: string[] = diff?.updated || [];
        const removed: string[] = diff?.removed || [];

        // Gom tất cả thay đổi vào 1 mảng duy nhất và kèm icon để không bị tách quá nhiều khối
        const allChanges = [
          ...added.map((k: string) => `➕ ${k}`),
          ...updated.map((k: string) => `✏️ ${k}`),
          ...removed.map((k: string) => `🗑 ${k}`)
        ];

        // Nếu thực sự không có biến nào thay đổi thì kết thúc sớm, không gửi thông báo
        if (allChanges.length === 0) {
          return c.json({ success: true, message: "No actual secret changes. Skipped." });
        }

        let diffText = `<b>Changes:</b> <code>${allChanges.join(", ")}</code>`;

        // Giới hạn độ dài để đảm bảo LUÔN chỉ gửi 1 tin nhắn Telegram duy nhất
        if (diffText.length > 3500) {
          diffText = diffText.substring(0, 3500) + "...</code> (đã cắt bớt do quá dài)";
        }

        message =
          `🔐 <b>DOPPLER SECRETS UPDATED</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `🏢 <b>Workplace:</b> <code>${workplace?.name || "Unknown"}</code>\n` +
          `📁 <b>Project:</b> <code>${project?.name || "Unknown"}</code>\n` +
          `⚙️ <b>Config:</b> <code>${config?.name || "Unknown"}</code>\n` +
          `🌐 <b>Environment:</b> <code>${config?.environment || "Unknown"}</code>\n` +
          `🪝 <b>Webhook:</b> <code>${webhook?.name || "Unknown"}</code>\n\n` +
          `${diffText}`;

        // Generic fallback for other event types
      } else {
        message =
          `📡 <b>DOPPLER EVENT</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `🏷 <b>Type:</b> <code>${eventType}</code>\n` +
          `📦 <b>Project:</b> <code>${payload.project?.name || "Unknown"}</code>\n` +
          `🏢 <b>Workplace:</b> <code>${payload.workplace?.name || "Unknown"}</code>`;
      }

      if (message) {
        const botToken = await getSetting(
          c.env.DB,
          "TELEGRAM_BOT_TOKEN",
          c.env,
        );
        const chatId = await getSetting(
          c.env.DB,
          "TELEGRAM_CHAT_ID_DOPPLER",
          c.env,
        );
        await sendToTelegram(botToken, chatId, message);
      }

      return c.json({ success: true });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  }
}