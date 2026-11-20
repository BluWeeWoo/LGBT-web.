-- Existing PHP/MySQL installations only. The migration runner applies missing columns.
ALTER TABLE stories ADD COLUMN photo_album CHAR(36) CHARACTER SET ascii COLLATE ascii_bin;
ALTER TABLE stories ADD COLUMN removing BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE story_photos ADD COLUMN has_portrait_print BOOLEAN NOT NULL DEFAULT FALSE;
