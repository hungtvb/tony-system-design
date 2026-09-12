-- Manual schema for tony-system-design (Postgres).
-- Canonical provisioning contract aligned with src/db/schema.ts.
-- For an existing database, use Drizzle migrations/push rather than re-running
-- CREATE TABLE IF NOT EXISTS as a migration mechanism.

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text UNIQUE,
  "emailVerified" timestamp with time zone,
  image text,
  password_hash varchar(255),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type varchar(255) NOT NULL,
  provider varchar(255) NOT NULL,
  "providerAccountId" varchar(255) NOT NULL,
  refresh_token text,
  access_token text,
  expires_at integer,
  token_type varchar(255),
  scope varchar(255),
  id_token text,
  session_state varchar(255),
  CONSTRAINT account_compound_key PRIMARY KEY (provider, "providerAccountId")
);

CREATE TABLE IF NOT EXISTS sessions (
  "sessionToken" varchar(255) PRIMARY KEY,
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier varchar(255) NOT NULL,
  token varchar(255) NOT NULL,
  expires timestamp with time zone NOT NULL,
  CONSTRAINT verification_token_compound_key PRIMARY KEY (identifier, token)
);

CREATE TYPE design_status AS ENUM ('draft', 'published');

CREATE TABLE IF NOT EXISTS auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(255) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_attempts_key_idx ON auth_attempts(key);

CREATE TABLE IF NOT EXISTS designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL,
  description text,
  status design_status NOT NULL DEFAULT 'draft',
  canvas_data jsonb NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS design_user_idx ON designs("user_id");
CREATE INDEX IF NOT EXISTS design_public_idx ON designs(is_public);

CREATE TABLE IF NOT EXISTS test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "design_id" uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind varchar(32) NOT NULL,
  result jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS testrun_design_idx ON test_runs("design_id");

CREATE TABLE IF NOT EXISTS quiz_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(120) NOT NULL UNIQUE,
  title varchar(200) NOT NULL,
  prompt text NOT NULL,
  requirements jsonb NOT NULL,
  scale_target jsonb,
  difficulty varchar(16) NOT NULL DEFAULT 'medium',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quiz_slug_idx ON quiz_problems(slug);
