-- Characters we follow during local testing.
-- The Discord bot will later write into this same table.
INSERT INTO characters (slug, region, added_by, active)
VALUES ('raekwon-rosebrook', 'eu', 'seed', 1)
ON CONFLICT (slug, region) DO NOTHING;
