 
-- Migration: Add separate Telegram Chat IDs for GitHub and Doppler notifications
-- Replace single TELEGRAM_CHAT_ID with two separate chat IDs

-- Update existing TELEGRAM_CHAT_ID key to TELEGRAM_CHAT_ID_GITHUB
UPDATE settings 
SET key = 'TELEGRAM_CHAT_ID_GITHUB' 
WHERE key = 'TELEGRAM_CHAT_ID';

-- Insert TELEGRAM_CHAT_ID_DOPPLER
INSERT INTO settings (key, value)
VALUES ('TELEGRAM_CHAT_ID_DOPPLER', '-5122241331')
ON CONFLICT(key) DO NOTHING;
