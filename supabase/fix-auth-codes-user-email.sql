-- Quick fix: Add user_email column to auth_codes table
-- Run this in your Supabase SQL editor

ALTER TABLE auth_codes ADD COLUMN IF NOT EXISTS user_email TEXT;

-- If table is empty, make it NOT NULL directly
-- If table has data, update existing rows first
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM auth_codes WHERE user_email IS NULL) THEN
        -- Update existing rows (you may want to set a different default)
        UPDATE auth_codes SET user_email = 'migrated@auth-agent.com' WHERE user_email IS NULL;
    END IF;
    
    -- Make it NOT NULL
    ALTER TABLE auth_codes ALTER COLUMN user_email SET NOT NULL;
EXCEPTION
    WHEN OTHERS THEN
        -- If there are no rows, we can set NOT NULL directly
        IF NOT EXISTS (SELECT 1 FROM auth_codes LIMIT 1) THEN
            ALTER TABLE auth_codes ALTER COLUMN user_email SET NOT NULL;
        END IF;
END $$;

