CREATE TABLE shelves (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL,
  notes       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX shelves_name_key ON shelves (lower(name));

CREATE TABLE products (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Digits only, 12-digit UPCs stored zero-padded to 13. NULL for items
  -- with no barcode (produce, home-canned goods).
  barcode     text UNIQUE,
  name        text NOT NULL,
  brand       text NOT NULL DEFAULT '',
  size        text NOT NULL DEFAULT '',
  category    text NOT NULL DEFAULT '',
  image_url   text NOT NULL DEFAULT '',
  -- Where the details came from: openfoodfacts | upcitemdb | manual
  source      text NOT NULL DEFAULT 'manual',
  quantity    integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  shelf_id    integer REFERENCES shelves (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_shelf_id_idx ON products (shelf_id);

-- Every change to a quantity, so "what went out this month" is answerable.
CREATE TABLE stock_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id  integer NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  delta       integer NOT NULL,
  -- in | out | adjust
  reason      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_events_created_at_idx ON stock_events (created_at DESC);
CREATE INDEX stock_events_product_id_idx ON stock_events (product_id);
