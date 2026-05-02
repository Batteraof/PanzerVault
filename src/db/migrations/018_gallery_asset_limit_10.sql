ALTER TABLE gallery_assets
  DROP CONSTRAINT IF EXISTS gallery_assets_display_order_check;

ALTER TABLE gallery_assets
  ADD CONSTRAINT gallery_assets_display_order_check
  CHECK (display_order BETWEEN 1 AND 10);
