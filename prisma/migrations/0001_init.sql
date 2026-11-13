-- CreateTable
CREATE TABLE "characters" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'eu',
    "added_by" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "snapshots" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "character_id" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "equipped_item_level" INTEGER NOT NULL DEFAULT 0,
    "achievement_points" INTEGER NOT NULL DEFAULT 0,
    "achievement_count" INTEGER NOT NULL DEFAULT 0,
    "last_login_timestamp" INTEGER,
    "professions_json" TEXT,
    "specializations_json" TEXT,
    "achievements_json" TEXT,
    "titles_json" TEXT,
    "fetched_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "snapshots_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "character_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "message" TEXT,
    "published_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "events_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "oauth_tokens" (
    "region" TEXT NOT NULL PRIMARY KEY,
    "access_token" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "characters_slug_region_key" ON "characters"("slug", "region");

-- CreateIndex
CREATE INDEX "snapshots_character_id_fetched_at_idx" ON "snapshots"("character_id", "fetched_at");

-- CreateIndex
CREATE UNIQUE INDEX "events_character_id_dedupe_key_key" ON "events"("character_id", "dedupe_key");

