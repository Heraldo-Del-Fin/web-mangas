// Installed with the existing schema initializer. One call = one transaction.
export const CHAPTER_WRITE_SCHEMA_SQL = `
DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('kurumanga-chapter-write-v2'));
  IF EXISTS (SELECT 1 FROM kurumanga_schema_migrations WHERE id='chapter-write-v2') THEN RETURN; END IF;
  ALTER TABLE chapter_uploads ALTER COLUMN scanlation_id DROP NOT NULL;
  ALTER TABLE chapter_uploads ALTER COLUMN scanlation_name DROP NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_chapters_manga_number ON chapters(manga_id,number);
  CREATE INDEX IF NOT EXISTS idx_scanlation_members_user_scan ON scanlation_members(user_id,scanlation_id);
CREATE OR REPLACE FUNCTION insert_kuramanga_chapter(p JSONB) RETURNS JSONB
LANGUAGE plpgsql AS $chapter$
DECLARE
  u users%ROWTYPE;
  m mangas%ROWTYPE;
  s scanlations%ROWTYPE;
  c chapters%ROWTYPE;
  n double precision := (p->>'number')::double precision;
BEGIN
  SELECT * INTO u FROM users WHERE id=p->>'userId' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuario no disponible'; END IF;
  IF u.role NOT IN ('ADMIN','UPLOADER') AND NOT EXISTS (
    SELECT 1 FROM scanlation_members WHERE user_id=u.id AND scanlation_id=p->>'scanId'
  ) THEN RAISE EXCEPTION 'Sin permiso para el grupo'; END IF;
  IF n < 0 OR n::text IN ('NaN','Infinity','-Infinity') OR n IS NULL THEN
    RAISE EXCEPTION 'Número inválido';
  END IF;
  IF jsonb_typeof(p->'pages') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Páginas inválidas'; END IF;
  IF jsonb_array_length(p->'pages')=0 OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p->'pages') page WHERE jsonb_typeof(page)<>'string' OR page #>> '{}' = ''
  ) THEN RAISE EXCEPTION 'Páginas inválidas'; END IF;

  -- Serialize chapter creation for the same manga, without locking other works.
  SELECT * INTO m FROM mangas WHERE id=p->>'mangaId' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Obra no disponible'; END IF;
  SELECT * INTO s FROM scanlations WHERE id=p->>'scanId' FOR UPDATE;
  IF NOT FOUND THEN
    IF COALESCE(p->>'customScanName','')<>'' AND u.role IN ('ADMIN','UPLOADER') THEN
      INSERT INTO scanlations(id,name,slug,owner_id,verified,description,members_count,uploads_count)
      VALUES(p->>'newScanId',p->>'customScanName',p->>'newScanSlug',u.id,u.role='ADMIN',
        'Grupo de traducción administrado por '||u.username||'.',1,0) RETURNING * INTO s;
      INSERT INTO scanlation_members(id,scanlation_id,scanlation_name,user_id,username,email,role)
      VALUES(p->>'memberId',s.id,s.name,u.id,u.username,u.email,'SCAN_LEADER');
    ELSIF COALESCE(p->>'scanId','')<>'' THEN RAISE EXCEPTION 'Grupo no disponible';
    END IF;
  END IF;
  SELECT * INTO c FROM chapters WHERE manga_id=m.id AND number=n ORDER BY created_at,id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO chapters(id,manga_id,number,title)
    VALUES(p->>'chapterId',m.id,n,p->>'title') RETURNING * INTO c;
  ELSIF c.title IS DISTINCT FROM p->>'title' THEN
    UPDATE chapters SET title=p->>'title' WHERE id=c.id RETURNING * INTO c;
  END IF;
  INSERT INTO chapter_uploads(id,chapter_id,manga_id,manga_slug,manga_title,manga_cover,manga_type,
    manga_demography,chapter_number,chapter_title,scanlation_id,scanlation_name,uploader_id,uploader_username,language,pages)
  VALUES(p->>'uploadId',c.id,m.id,m.slug,m.title,m.cover_url,m.type,m.demography,n,c.title,s.id,s.name,u.id,u.username,'ES',p->'pages');
  UPDATE scanlations SET uploads_count=uploads_count+1 WHERE id=s.id;
  RETURN jsonb_build_object('uploadId',p->>'uploadId','mangaSlug',m.slug);
END;
$chapter$;
  INSERT INTO kurumanga_schema_migrations(id) VALUES('chapter-write-v2');
END;
$migration$;
`;
