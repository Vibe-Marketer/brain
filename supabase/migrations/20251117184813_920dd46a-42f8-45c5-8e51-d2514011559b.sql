-- Increase PostgREST max rows from 1000 to 10000 to prevent transcript truncation
ALTER ROLE authenticator SET pgrst.db_max_rows = 10000;

-- Reload PostgREST configuration
NOTIFY pgrst, 'reload config';