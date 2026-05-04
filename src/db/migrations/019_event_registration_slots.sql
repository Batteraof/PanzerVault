ALTER TABLE guild_events
  ADD COLUMN IF NOT EXISTS registration_mode text NOT NULL DEFAULT 'rsvp',
  ADD COLUMN IF NOT EXISTS map_name text,
  ADD COLUMN IF NOT EXISTS rules text;

ALTER TABLE guild_events
  DROP CONSTRAINT IF EXISTS guild_events_registration_mode_check;

ALTER TABLE guild_events
  ADD CONSTRAINT guild_events_registration_mode_check
  CHECK (registration_mode IN ('rsvp', 'slots'));

CREATE TABLE IF NOT EXISTS event_registration_slots (
  id bigserial PRIMARY KEY,
  event_id bigint NOT NULL REFERENCES guild_events(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 50),
  display_order integer NOT NULL DEFAULT 1 CHECK (display_order BETWEEN 1 AND 25),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, display_order),
  UNIQUE (event_id, label)
);

CREATE INDEX IF NOT EXISTS idx_event_registration_slots_event
  ON event_registration_slots (event_id, display_order);

ALTER TABLE event_rsvps
  ADD COLUMN IF NOT EXISTS slot_id bigint REFERENCES event_registration_slots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_event_rsvps_slot
  ON event_rsvps (slot_id)
  WHERE slot_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_event_registration_slots_updated_at ON event_registration_slots;
CREATE TRIGGER trg_event_registration_slots_updated_at
BEFORE UPDATE ON event_registration_slots
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
