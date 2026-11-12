// Additive, versioned migration. SQL runs atomically; repeat executions are safe.
export const SEO_SCHEMA_SQL = `
DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('kurumanga-seo-schema'));
  CREATE TABLE IF NOT EXISTS kurumanga_schema_migrations (
    id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  IF EXISTS (SELECT 1 FROM kurumanga_schema_migrations WHERE id='seo-v1') THEN RETURN; END IF;

  ALTER TABLE mangas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
  ALTER TABLE chapter_uploads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
  ALTER TABLE scanlations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
  UPDATE mangas SET updated_at=created_at WHERE updated_at IS NULL;
  UPDATE chapter_uploads SET updated_at=created_at WHERE updated_at IS NULL;
  ALTER TABLE mangas ALTER COLUMN updated_at SET DEFAULT NOW();
  ALTER TABLE chapter_uploads ALTER COLUMN updated_at SET DEFAULT NOW();
  ALTER TABLE scanlations ALTER COLUMN updated_at SET DEFAULT NOW();

  -- Keep the original aggregate for audit before removing the synthetic 5/1 seed.
  ALTER TABLE mangas ADD COLUMN IF NOT EXISTS legacy_rating DOUBLE PRECISION;
  ALTER TABLE mangas ADD COLUMN IF NOT EXISTS legacy_votes_count INTEGER;
  UPDATE mangas SET legacy_rating=rating, legacy_votes_count=votes_count,
    rating=CASE WHEN votes_count<=1 THEN 0 ELSE
      GREATEST(1, LEAST(5, ROUND(((rating*votes_count-5)/(votes_count-1))::numeric, 2)::double precision)) END,
    votes_count=GREATEST(votes_count-1, 0);
  ALTER TABLE mangas ALTER COLUMN rating SET DEFAULT 0;
  ALTER TABLE mangas ALTER COLUMN votes_count SET DEFAULT 0;

  CREATE TABLE IF NOT EXISTS manga_slug_redirects (
    old_slug TEXT PRIMARY KEY,
    manga_id TEXT NOT NULL REFERENCES mangas(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_manga_slug_redirects_manga ON manga_slug_redirects(manga_id);
  CREATE INDEX IF NOT EXISTS idx_mangas_slug_lookup ON mangas(slug);

  CREATE OR REPLACE FUNCTION kurumanga_seo_stamp() RETURNS trigger LANGUAGE plpgsql AS $stamp$
  BEGIN
    IF TG_OP='UPDATE' AND
      (to_jsonb(NEW)-ARRAY['views','rating','votes_count','updated_at']) IS DISTINCT FROM
      (to_jsonb(OLD)-ARRAY['views','rating','votes_count','updated_at']) THEN
      NEW.updated_at=NOW();
    END IF;
    RETURN NEW;
  END; $stamp$;
  CREATE TRIGGER mangas_seo_stamp BEFORE UPDATE ON mangas
    FOR EACH ROW EXECUTE FUNCTION kurumanga_seo_stamp();
  CREATE TRIGGER uploads_seo_stamp BEFORE UPDATE ON chapter_uploads
    FOR EACH ROW EXECUTE FUNCTION kurumanga_seo_stamp();
  CREATE TRIGGER scans_seo_stamp BEFORE UPDATE ON scanlations
    FOR EACH ROW EXECUTE FUNCTION kurumanga_seo_stamp();

  CREATE OR REPLACE FUNCTION kurumanga_reserve_slug() RETURNS trigger LANGUAGE plpgsql AS $reserve$
  BEGIN
    IF EXISTS (SELECT 1 FROM manga_slug_redirects WHERE old_slug=NEW.slug AND manga_id<>NEW.id) THEN
      RAISE EXCEPTION 'El slug pertenece al historial de otra obra' USING ERRCODE='unique_violation';
    END IF;
    RETURN NEW;
  END; $reserve$;
  CREATE TRIGGER reserve_manga_slug BEFORE INSERT OR UPDATE OF slug ON mangas
    FOR EACH ROW EXECUTE FUNCTION kurumanga_reserve_slug();
  CREATE OR REPLACE FUNCTION kurumanga_remember_slug() RETURNS trigger LANGUAGE plpgsql AS $remember$
  BEGIN
    IF OLD.slug IS DISTINCT FROM NEW.slug THEN
      INSERT INTO manga_slug_redirects(old_slug,manga_id) VALUES(OLD.slug,NEW.id)
        ON CONFLICT(old_slug) DO NOTHING;
    END IF;
    RETURN NEW;
  END; $remember$;
  CREATE TRIGGER remember_manga_slug AFTER UPDATE OF slug ON mangas
    FOR EACH ROW EXECUTE FUNCTION kurumanga_remember_slug();

  CREATE OR REPLACE FUNCTION kurumanga_touch_parent_pages() RETURNS trigger LANGUAGE plpgsql AS $parents$
  BEGIN
    IF TG_OP='UPDATE' AND
      (to_jsonb(NEW)-ARRAY['views','updated_at']) IS NOT DISTINCT FROM
      (to_jsonb(OLD)-ARRAY['views','updated_at']) THEN RETURN NULL; END IF;
    IF TG_OP<>'INSERT' THEN
      UPDATE mangas SET updated_at=NOW() WHERE id=OLD.manga_id;
      UPDATE scanlations SET updated_at=NOW() WHERE id=OLD.scanlation_id;
    END IF;
    IF TG_OP<>'DELETE' THEN
      UPDATE mangas SET updated_at=NOW() WHERE id=NEW.manga_id;
      UPDATE scanlations SET updated_at=NOW() WHERE id=NEW.scanlation_id;
    END IF;
    RETURN NULL;
  END; $parents$;
  CREATE TRIGGER touch_upload_parents AFTER INSERT OR UPDATE OR DELETE ON chapter_uploads
    FOR EACH ROW EXECUTE FUNCTION kurumanga_touch_parent_pages();

  INSERT INTO kurumanga_schema_migrations(id) VALUES('seo-v1');
END; $migration$;
`;
