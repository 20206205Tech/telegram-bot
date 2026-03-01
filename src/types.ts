import type { Context } from "hono";

export interface Env {
  DB: D1Database;
  PASSWORD?: string;
  WEBHOOK_GITHUB_SECRET?: string;
  WEBHOOK_DOPPLER_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID_GITHUB?: string;
  TELEGRAM_CHAT_ID_DOPPLER?: string;
}

export type AppContext = Context<{ Bindings: Env }>;

export interface Settings {
  PASSWORD: string;
  WEBHOOK_GITHUB_SECRET: string;
  WEBHOOK_DOPPLER_SECRET: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID_GITHUB: string;
  TELEGRAM_CHAT_ID_DOPPLER: string;
}

export type SettingKey = keyof Settings;
