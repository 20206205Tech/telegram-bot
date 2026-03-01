import { Env, SettingKey, Settings } from "../types";

/**
 * Lấy giá trị setting từ DB, fallback sang env nếu không có
 */
export async function getSetting(
  db: D1Database,
  key: SettingKey,
  env: Env,
): Promise<string> {
  const result = await db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();

  if (result?.value) {
    return result.value;
  }

  // Fallback sang biến môi trường hoặc giá trị example
  return env[key] || `example_${key.toLowerCase()}`;
}

/**
 * Lấy tất cả settings
 */
export async function getAllSettings(
  db: D1Database,
  env: Env,
): Promise<Settings> {
  const keys: SettingKey[] = [
    "PASSWORD",
    "WEBHOOK_GITHUB_SECRET",
    "WEBHOOK_DOPPLER_SECRET",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID_GITHUB",
    "TELEGRAM_CHAT_ID_DOPPLER",
  ];

  const settings: Partial<Settings> = {};

  for (const key of keys) {
    settings[key] = await getSetting(db, key, env);
  }

  return settings as Settings;
}
