-- Migration: Create settings table
-- Created at: 2026-02-16

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT
);

-- Tạo Index cho cột key để tối ưu truy vấn
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings (key);