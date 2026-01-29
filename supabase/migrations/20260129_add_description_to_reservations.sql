-- Add description column to reservations table
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS description TEXT;