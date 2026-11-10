-- ============================================================================
-- ESQUEMA POSTGRESQL PARA NEON (KuraManga)
-- Las imágenes se almacenan en Cloudflare R2 y Neon solo guarda las URLs (~60B)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'READER' CHECK (role IN ('READER', 'UPLOADER', 'ADMIN')),
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS scanlation_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT NOT NULL DEFAULT '',
  discord TEXT,
  website TEXT,
  members_count INT NOT NULL DEFAULT 1,
  uploads_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Miembros designados dentro de cada Scanlation
-- SCAN_LEADER: Administrador del Scanlation (puede designar SCAN_UPLOADER para su grupo)
-- SCAN_UPLOADER: Usuario autorizado para subir capítulos exclusivamente en este Scanlation
CREATE TABLE IF NOT EXISTS scanlation_members (
  id TEXT PRIMARY KEY,
  scanlation_id TEXT NOT NULL REFERENCES scanlation_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('SCAN_LEADER', 'SCAN_UPLOADER')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scanlation_id, user_id)
);

-- Solicitudes de usuarios READER para pasar a UPLOADER o fundar un Scanlation
CREATE TABLE IF NOT EXISTS uploader_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('BECOME_UPLOADER', 'CREATE_SCANLATION')),
  reason TEXT NOT NULL,
  proposed_scan_name TEXT,
  proposed_scan_description TEXT,
  proposed_scan_discord TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS mangas (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  alt_titles TEXT[] NOT NULL DEFAULT '{}',
  synopsis TEXT NOT NULL,
  cover_url TEXT NOT NULL,
  banner_url TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('MANGA', 'MANHWA', 'MANHUA', 'ONE_SHOT', 'DOUJINSHI', 'NOVELA')),
  demography TEXT NOT NULL CHECK (demography IN ('SHOUNEN', 'SEINEN', 'SHOUJO', 'JOSEI', 'KODOMO')),
  status TEXT NOT NULL DEFAULT 'EN_PUBLICACION',
  author TEXT NOT NULL,
  artist TEXT NOT NULL,
  release_year INT NOT NULL DEFAULT 2026,
  genres TEXT[] NOT NULL DEFAULT '{}',
  rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  votes_count INT NOT NULL DEFAULT 1,
  views INT NOT NULL DEFAULT 0,
  created_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mangas_genres ON mangas USING GIN (genres);
CREATE INDEX IF NOT EXISTS idx_mangas_type_demo ON mangas (type, demography);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  manga_id TEXT NOT NULL REFERENCES mangas(id) ON DELETE CASCADE,
  number NUMERIC(6,2) NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (manga_id, number)
);

CREATE TABLE IF NOT EXISTS chapter_uploads (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  manga_id TEXT NOT NULL REFERENCES mangas(id) ON DELETE CASCADE,
  scanlation_id TEXT NOT NULL REFERENCES scanlation_groups(id) ON DELETE CASCADE,
  uploader_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  language TEXT NOT NULL DEFAULT 'ES',
  -- Array ordenado de URLs apuntando a Cloudflare R2 (solo ~60 bytes por URL)
  pages TEXT[] NOT NULL DEFAULT '{}',
  views INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_library (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manga_id TEXT NOT NULL REFERENCES mangas(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('SIGUIENDO', 'PENDIENTE', 'LEIDO', 'FAVORITO', 'ABANDONADO')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, manga_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  manga_id TEXT NOT NULL REFERENCES mangas(id) ON DELETE CASCADE,
  chapter_number NUMERIC(6,2),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL DEFAULT 'READER',
  content TEXT NOT NULL,
  spoiler BOOLEAN NOT NULL DEFAULT FALSE,
  likes INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

