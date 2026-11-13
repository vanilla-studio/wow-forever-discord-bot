-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_snapshots" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "character_id" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "equipped_item_level" INTEGER NOT NULL DEFAULT 0,
    "achievement_points" INTEGER NOT NULL DEFAULT 0,
    "achievement_count" INTEGER NOT NULL DEFAULT 0,
    "last_login_timestamp" INTEGER,
    "guild" TEXT,
    "epic_count" INTEGER NOT NULL DEFAULT 0,
    "total_deaths" INTEGER NOT NULL DEFAULT 0,
    "falling_deaths" INTEGER NOT NULL DEFAULT 0,
    "quests_completed" INTEGER NOT NULL DEFAULT 0,
    "professions_json" TEXT,
    "specializations_json" TEXT,
    "achievements_json" TEXT,
    "titles_json" TEXT,
    "fetched_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "snapshots_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_snapshots" ("achievement_count", "achievement_points", "achievements_json", "character_id", "equipped_item_level", "fetched_at", "id", "last_login_timestamp", "level", "professions_json", "specializations_json", "titles_json") SELECT "achievement_count", "achievement_points", "achievements_json", "character_id", "equipped_item_level", "fetched_at", "id", "last_login_timestamp", "level", "professions_json", "specializations_json", "titles_json" FROM "snapshots";
DROP TABLE "snapshots";
ALTER TABLE "new_snapshots" RENAME TO "snapshots";
CREATE INDEX "snapshots_character_id_fetched_at_idx" ON "snapshots"("character_id", "fetched_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

