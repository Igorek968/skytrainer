CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE resorts (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  center GEOGRAPHY(POINT, 4326) NOT NULL,
  trail GEOGRAPHY(LINESTRING, 4326) NOT NULL
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('client', 'instructor')),
  fcm_token TEXT,
  display_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_phone ON users(phone) WHERE phone IS NOT NULL;

CREATE TABLE instructors (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  resort_slug TEXT NOT NULL REFERENCES resorts(slug),
  display_name TEXT NOT NULL,
  photo_url TEXT NOT NULL DEFAULT '',
  experience_years INT NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
  certificates JSONB NOT NULL DEFAULT '[]'::jsonb,
  hourly_rate INT NOT NULL CHECK (hourly_rate >= 500 AND hourly_rate <= 50000),
  avg_rating NUMERIC(3, 2) NOT NULL DEFAULT 5.00 CHECK (avg_rating >= 1 AND avg_rating <= 5),
  rating_count INT NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  priority_penalty BOOLEAN NOT NULL DEFAULT FALSE,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  availability TEXT NOT NULL DEFAULT 'available_now' CHECK (availability IN ('available_now', 'available_later', 'busy')),
  is_online BOOLEAN NOT NULL DEFAULT TRUE,
  languages TEXT[] NOT NULL DEFAULT ARRAY['ru']::TEXT[]
);

CREATE INDEX instructors_location_gix ON instructors USING GIST (location);
CREATE INDEX instructors_resort_idx ON instructors(resort_slug);

CREATE TYPE booking_status AS ENUM (
  'pending_payment',
  'paid',
  'confirmed',
  'active',
  'completed',
  'cancelled'
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES users(id),
  instructor_user_id UUID NOT NULL REFERENCES instructors(user_id),
  resort_slug TEXT NOT NULL REFERENCES resorts(slug),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  hours SMALLINT NOT NULL CHECK (hours >= 1 AND hours <= 8),
  status booking_status NOT NULL DEFAULT 'pending_payment',
  total_amount_kopeks BIGINT NOT NULL CHECK (total_amount_kopeks >= 0),
  platform_fee_kopeks BIGINT NOT NULL CHECK (platform_fee_kopeks >= 0),
  instructor_amount_kopeks BIGINT NOT NULL CHECK (instructor_amount_kopeks >= 0),
  yookassa_payment_id TEXT UNIQUE,
  qr_payload TEXT,
  reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
  review_prompt_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_end_after_start CHECK (end_at > start_at)
);

CREATE INDEX bookings_client_idx ON bookings(client_id);
CREATE INDEX bookings_instructor_idx ON bookings(instructor_user_id);
CREATE INDEX bookings_start_idx ON bookings(start_at);
CREATE INDEX bookings_status_idx ON bookings(status);

CREATE TABLE track_points (
  id BIGSERIAL PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  recorded_at TIMESTAMPTZ NOT NULL,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  speed REAL,
  altitude REAL,
  geom GEOGRAPHY(POINT, 4326) NOT NULL
);

CREATE INDEX track_points_booking_idx ON track_points(booking_id);
CREATE INDEX track_points_geom_gix ON track_points USING GIST (geom);

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES users(id),
  instructor_user_id UUID NOT NULL REFERENCES instructors(user_id),
  stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reviews_instructor_idx ON reviews(instructor_user_id);

CREATE TABLE favorites (
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instructor_user_id UUID NOT NULL REFERENCES instructors(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, instructor_user_id)
);

CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('yookassa_card', 'yookassa_sbp')),
  label TEXT NOT NULL,
  external_id TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payment_methods_user_idx ON payment_methods(user_id);

INSERT INTO resorts (slug, name, center, trail) VALUES
(
  'krasnaya',
  'Красная Поляна',
  ST_SetSRID(ST_MakePoint(40.205, 43.677), 4326)::geography,
  ST_SetSRID(ST_MakeLine(ARRAY[
    ST_MakePoint(40.198, 43.682),
    ST_MakePoint(40.210, 43.674),
    ST_MakePoint(40.215, 43.668)
  ]), 4326)::geography
),
(
  'sheregesh',
  'Шерегеш',
  ST_SetSRID(ST_MakePoint(87.987, 52.921), 4326)::geography,
  ST_SetSRID(ST_MakeLine(ARRAY[
    ST_MakePoint(87.980, 52.924),
    ST_MakePoint(87.992, 52.918),
    ST_MakePoint(87.995, 52.923)
  ]), 4326)::geography
),
(
  'dombay',
  'Домбай',
  ST_SetSRID(ST_MakePoint(41.623, 43.293), 4326)::geography,
  ST_SetSRID(ST_MakeLine(ARRAY[
    ST_MakePoint(41.618, 43.296),
    ST_MakePoint(41.628, 43.290),
    ST_MakePoint(41.620, 43.288)
  ]), 4326)::geography
);
