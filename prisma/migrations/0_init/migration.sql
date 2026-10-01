BEGIN;

CREATE TYPE reservation_status AS ENUM ('reserved', 'cancelled');

CREATE TABLE venues (
    id VARCHAR(36) NOT NULL,
    name TEXT NOT NULL,
    CONSTRAINT venues_pkey PRIMARY KEY (id)
);

CREATE TABLE events (
    id VARCHAR(36) NOT NULL,
    title TEXT NOT NULL,
    venue_id VARCHAR(36) NOT NULL,
    start_time TIMESTAMPTZ(3) NOT NULL,
    end_time TIMESTAMPTZ(3) NOT NULL,
    capacity INTEGER NOT NULL,
    CONSTRAINT events_pkey PRIMARY KEY (id),
    CONSTRAINT events_capacity_positive CHECK (capacity > 0),
    CONSTRAINT events_period_order CHECK (start_time < end_time),
    CONSTRAINT events_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX events_venue_id_idx ON events(venue_id);

CREATE TABLE reservations (
    id VARCHAR(36) NOT NULL,
    event_id VARCHAR(36) NOT NULL,
    user_id VARCHAR NOT NULL,
    status reservation_status NOT NULL,
    reserved_at TIMESTAMPTZ(3) NOT NULL,
    cancelled_at TIMESTAMPTZ(3),
    CONSTRAINT reservations_pkey PRIMARY KEY (id),
    CONSTRAINT reservations_status_cancelled_at CHECK (
        (status = 'reserved' AND cancelled_at IS NULL)
        OR (status = 'cancelled' AND cancelled_at IS NOT NULL)
    ),
    CONSTRAINT reservations_cancellation_order CHECK (
        cancelled_at IS NULL OR cancelled_at >= reserved_at
    ),
    CONSTRAINT reservations_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX reservations_event_id_status_idx ON reservations(event_id, status);
CREATE INDEX reservations_event_id_user_id_status_idx
    ON reservations(event_id, user_id, status);

-- キャンセル履歴を複数残しつつ、有効な予約だけ重複を禁止する。
CREATE UNIQUE INDEX reservations_event_user_reserved_key
    ON reservations(event_id, user_id)
    WHERE status = 'reserved';

COMMIT;
