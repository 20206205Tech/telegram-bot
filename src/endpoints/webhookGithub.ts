import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { getSetting } from "../utils/database";
import { verifySignature } from "../utils/github";
import { sendToTelegram } from "../utils/telegram";

export class WebhookGithubEndpoint extends OpenAPIRoute {
  public schema = {
    tags: ["Webhook"],
    summary: "GitHub Webhook Handler",
    description: `
Nhận webhook từ GitHub và gửi thông báo qua Telegram (GitHub chat).

Hỗ trợ các events:
- **push**: Khi có commit mới
- **pull_request**: Khi mở PR
- **issues**: Khi tạo issue
- **workflow_run**: Khi GitHub Action chạy/hoàn thành

Webhook phải có chữ ký HMAC-SHA256 hợp lệ trong header \`X-Hub-Signature-256\`.
    `,
    operationId: "github-webhook",
    request: {
      headers: z.object({
        "x-hub-signature-256": z.string().optional(),
        "x-github-event": z.string().optional(),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.any().describe("GitHub webhook payload"),
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
        description: "Invalid signature",
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
      const signature = c.req.header("x-hub-signature-256");
      const event = c.req.header("x-github-event");
      const body = await c.req.text();

      const secret = await getSetting(c.env.DB, "WEBHOOK_GITHUB_SECRET", c.env);
      const isValid = await verifySignature(body, signature || null, secret);

      if (!isValid) {
        return c.json(
          { success: false, error: "Unauthorized: Invalid Signature" },
          401,
        );
      }

      const payload = JSON.parse(body);
      const repoName = payload.repository?.name || "Unknown";
      const repoUrl = payload.repository?.html_url || "";
      const repoLink = `<a href="${repoUrl}">${repoName}</a>`;

      let message = "";

      // 1. PULL REQUEST
      if (event === "pull_request") {
        const pr = payload.pull_request;
        const action = payload.action.toUpperCase();
        const prIcon = action === "OPENED" ? "🆕" : "🔄";

        message =
          `${prIcon} <b>PULL REQUEST: ${action}</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `📦 <b>Repo:</b> ${repoLink}\n` +
          `📝 <b>Title:</b> <code>${pr.title}</code>\n` +
          `🌿 <b>Flow:</b> <code>${pr.head.ref}</code> ➔ <code>${pr.base.ref}</code>\n` +
          `👤 <b>By:</b> <a href="${pr.user.html_url}">${pr.user.login}</a>\n\n` +
          `🔗 <a href="${pr.html_url}">Xem chi tiết PR</a> | <a href="${pr.html_url}/files">Files Change</a>`;

        // 2. PUSH (COMMITS)
      } else if (event === "push") {
        const branch = payload.ref.replace("refs/heads/", "");
        const commitsCount = payload.commits?.length || 0;

        message =
          `🚀 <b>NEW PUSH DETECTED</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `📦 <b>Repo:</b> ${repoLink}\n` +
          `🌿 <b>Branch:</b> <code>${branch}</code>\n` +
          `🔢 <b>Commits:</b> ${commitsCount}\n` +
          `👤 <b>Pusher:</b> <code>${payload.pusher.name}</code>\n\n` +
          `📝 <b>Last Commit:</b>\n<i>"${payload.head_commit?.message}"</i>\n\n` +
          `🔗 <a href="${payload.compare}">View Changes on GitHub</a>`;

        // 3. ISSUES
      } else if (event === "issues") {
        const issue = payload.issue;
        const action = payload.action.toUpperCase();

        message =
          `⚠️ <b>ISSUE: ${action}</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `📦 <b>Repo:</b> ${repoLink}\n` +
          `🆔 <b>ID:</b> #${issue.number}\n` +
          `📝 <b>Title:</b> <code>${issue.title}</code>\n` +
          `👤 <b>By:</b> ${issue.user.login}\n\n` +
          `🔗 <a href="${issue.html_url}">Xem chi tiết Issue</a>`;

        // 4. WORKFLOW RUN (CI/CD)
      } else if (event === "workflow_run") {
        const run = payload.workflow_run;
        const workflowName = run.name;

        if (payload.action === "requested") {
          message =
            `⚙️ <b>CI/CD STARTED</b>\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `🛠 <b>Workflow:</b> <code>${workflowName}</code>\n` +
            `📦 <b>Repo:</b> ${repoLink}\n` +
            `🌿 <b>Branch:</b> <code>${run.head_branch}</code>\n\n` +
            `⏳ <a href="${run.html_url}">Checking progress...</a>`;
        } else if (payload.action === "completed") {
          const isSuccess = run.conclusion === "success";
          const statusIcon = isSuccess ? "✅" : "❌";
          const statusText = isSuccess ? "SUCCESS" : "FAILED";

          message =
            `${statusIcon} <b>CI/CD ${statusText}</b>\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `🛠 <b>Workflow:</b> <code>${workflowName}</code>\n` +
            `📦 <b>Repo:</b> ${repoLink}\n` +
            `🌿 <b>Branch:</b> <code>${run.head_branch}</code>\n\n` +
            `🔗 <a href="${run.html_url}">View Logs & Artifacts</a>`;
        }
      }

      if (message) {
        const botToken = await getSetting(
          c.env.DB,
          "TELEGRAM_BOT_TOKEN",
          c.env,
        );
        const chatId = await getSetting(
          c.env.DB,
          "TELEGRAM_CHAT_ID_GITHUB",
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
