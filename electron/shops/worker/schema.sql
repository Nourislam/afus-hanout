-- The owner's shops link (Cloudflare D1, on the owner's own account).
-- Made by Afus Boutique in the main shop; nothing here is a sale or a customer.
CREATE TABLE IF NOT EXISTS shops (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    last_seen TEXT,
    removed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS pair_codes (
    code_hash TEXT PRIMARY KEY,
    shop_name TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalog_parts (
    part INTEGER PRIMARY KEY,
    data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS join_failures (
    slot INTEGER PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0
);
