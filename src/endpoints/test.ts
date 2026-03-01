import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { getSetting } from "../utils/database";
import { sendToTelegram } from "../utils/telegram";

export class TestEndpoint extends OpenAPIRoute {
  public schema = {
    tags: ["Test"],
    summary: "Test Telegram Connection",
    description:
      "Gửi một tin nhắn test qua Telegram để kiểm tra kết nối. Yêu cầu password để tránh DDoS.",
    operationId: "test-telegram",
    request: {
      query: z.object({
        password: z.string().describe("Password để xác thực (lưu trong DB)"),
        target: z
          .enum(["github", "doppler", "all"])
          .default("all")
          .describe("Chọn chat nhận tin nhắn test: github | doppler | all"),
      }),
    },
    responses: {
      "200": {
        description: "Test message sent successfully",
        ...contentJson({
          success: z.boolean(),
          message: z.string(),
        }),
      },
      "401": {
        description: "Unauthorized - Password không đúng",
        ...contentJson({
          success: z.boolean(),
          error: z.string(),
        }),
      },
      "500": {
        description: "Failed to send test message",
        ...contentJson({
          success: z.boolean(),
          error: z.string(),
        }),
      },
    },
  };

  public async handle(c: AppContext) {
    try {
      const data = await this.getValidatedData<typeof this.schema>();
      const { password: inputPassword, target } = data.query;

      // Kiểm tra password
      const correctPassword = await getSetting(c.env.DB, "PASSWORD", c.env);
      if (!inputPassword || inputPassword !== correctPassword) {
        return c.json(
          {
            success: false,
            error: "Unauthorized: Invalid or missing password",
          },
          401,
        );
      }

      const botToken = await getSetting(c.env.DB, "TELEGRAM_BOT_TOKEN", c.env);

      const testMessage = (label: string) =>
        `🔔 <b>Test Connection [${label.toUpperCase()}]:</b>\nBot hoạt động tốt! Webhook đã sẵn sàng nhận request.`;

      const sends: Promise<Response>[] = [];

      if (target === "github" || target === "all") {
        const chatId = await getSetting(
          c.env.DB,
          "TELEGRAM_CHAT_ID_GITHUB",
          c.env,
        );
        sends.push(sendToTelegram(botToken, chatId, testMessage("GitHub")));
      }

      if (target === "doppler" || target === "all") {
        const chatId = await getSetting(
          c.env.DB,
          "TELEGRAM_CHAT_ID_DOPPLER",
          c.env,
        );
        sends.push(sendToTelegram(botToken, chatId, testMessage("Doppler")));
      }

      await Promise.all(sends);

      return c.json({
        success: true,
        message: `Test message sent to: ${target}`,
      });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  }
}
