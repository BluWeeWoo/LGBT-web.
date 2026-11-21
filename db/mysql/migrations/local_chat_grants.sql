-- The Windows XAMPP installer uses these fixed local-only accounts.
GRANT SELECT, INSERT, UPDATE ON rye_atlas.chat_preferences TO 'rye_atlas_app'@'localhost', 'rye_atlas_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON rye_atlas.chat_connections TO 'rye_atlas_app'@'localhost', 'rye_atlas_app'@'127.0.0.1';
GRANT SELECT, INSERT ON rye_atlas.chat_messages TO 'rye_atlas_app'@'localhost', 'rye_atlas_app'@'127.0.0.1';
