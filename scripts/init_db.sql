-- Run automatically on first Postgres container startup
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Seed an admin recruiter (password: Admin@123)
-- Hash generated via: passlib.context.CryptContext(schemes=["argon2"]).hash("Admin@123")
INSERT INTO recruiters (id, user_name, email, hashed_password, is_active, is_admin)
VALUES (
  uuid_generate_v4(),
  'Admin',
  'admin@ats.com',
  '$argon2id$v=19$m=65540,t=3,p=4$bXk0YzQ2OTI0YjEyODYxZQ$TRFOxyXmDVlXYuTDm8d4kA',
  true,
  true
) ON CONFLICT (email) DO NOTHING;
