-- Existing PHP/MySQL installations only. Run through the migration runner after it verifies the copied photos.
ALTER TABLE story_photos DROP COLUMN jpeg, DROP COLUMN portrait_jpeg;
