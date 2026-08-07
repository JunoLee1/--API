// Seeds essential demo users after migrations are applied.
// Runs on container startup, after prisma migrate deploy.
const { Client } = require('pg');

const HASH = '$2b$10$hzKOhKCCOJnkFxePPysHkur/nNunSDm8yoKMKVhAxpevMG9KkyhXi';

const seedSql = `
DO $seed$ DECLARE
  v_country_id INTEGER;
  v_club_id    INTEGER;
  v_phone_id   INTEGER;
BEGIN
  -- Ensure Country exists
  SELECT id INTO v_country_id FROM "Country" ORDER BY id LIMIT 1;
  IF v_country_id IS NULL THEN
    INSERT INTO "Country" (name, code) VALUES ('대한민국', 'KR') RETURNING id INTO v_country_id;
  END IF;

  -- Ensure Club exists
  SELECT id INTO v_club_id FROM "Club" ORDER BY id LIMIT 1;
  IF v_club_id IS NULL THEN
    INSERT INTO "Club" (name, "countryId") VALUES ('데모 FC', v_country_id) RETURNING id INTO v_club_id;
  END IF;

  -- superadmin
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'superadmin@platform.com') THEN
    INSERT INTO "PhoneNumber" (encrypted, iv) VALUES ('dummy', 'dummy') RETURNING id INTO v_phone_id;
    INSERT INTO "User" (email, password, username, nickname, role, "dateOfBirth", "nationalityId", "phoneNumberId")
    VALUES ('superadmin@platform.com', '${HASH}', 'superadmin', 'superadmin', 'SUPER_ADMIN', '1990-01-01', v_country_id, v_phone_id);
  END IF;

  -- HR Manager
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'hr@club.com') THEN
    INSERT INTO "PhoneNumber" (encrypted, iv) VALUES ('dummy_hr_mgr', 'dummy') RETURNING id INTO v_phone_id;
    INSERT INTO "User" (email, password, username, nickname, role, "frontOfficeRole", "clubId", "dateOfBirth", "nationalityId", "phoneNumberId")
    VALUES ('hr@club.com', '${HASH}', 'HR매니저', 'hr_manager', 'FRONT_OFFICE', 'HR_MANAGER', v_club_id, '1990-01-01', v_country_id, v_phone_id);
  END IF;

  -- HR Staff
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'hr.staff@club.com') THEN
    INSERT INTO "PhoneNumber" (encrypted, iv) VALUES ('dummy_hr_staff', 'dummy') RETURNING id INTO v_phone_id;
    INSERT INTO "User" (email, password, username, nickname, role, "frontOfficeRole", "clubId", "dateOfBirth", "nationalityId", "phoneNumberId")
    VALUES ('hr.staff@club.com', '${HASH}', 'HR직원', 'hr_staff', 'FRONT_OFFICE', 'HR_STAFF', v_club_id, '1990-01-01', v_country_id, v_phone_id);
  END IF;

  -- Asset Manager
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'asset.manager@club.com') THEN
    INSERT INTO "PhoneNumber" (encrypted, iv) VALUES ('dummy_asset_mgr', 'dummy') RETURNING id INTO v_phone_id;
    INSERT INTO "User" (email, password, username, nickname, role, "frontOfficeRole", "clubId", "dateOfBirth", "nationalityId", "phoneNumberId")
    VALUES ('asset.manager@club.com', '${HASH}', '자산관리팀장', 'asset_manager', 'FRONT_OFFICE', 'ASSET_MANAGER', v_club_id, '1990-01-01', v_country_id, v_phone_id);
  END IF;

  -- Asset Staff
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'asset.staff@club.com') THEN
    INSERT INTO "PhoneNumber" (encrypted, iv) VALUES ('dummy_asset_staff', 'dummy') RETURNING id INTO v_phone_id;
    INSERT INTO "User" (email, password, username, nickname, role, "frontOfficeRole", "clubId", "dateOfBirth", "nationalityId", "phoneNumberId")
    VALUES ('asset.staff@club.com', '${HASH}', '자산관리직원', 'asset_staff', 'FRONT_OFFICE', 'ASSET_STAFF', v_club_id, '1990-01-01', v_country_id, v_phone_id);
  END IF;

  -- Finance Manager
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'finance.manager@club.com') THEN
    INSERT INTO "PhoneNumber" (encrypted, iv) VALUES ('dummy_finance_mgr', 'dummy') RETURNING id INTO v_phone_id;
    INSERT INTO "User" (email, password, username, nickname, role, "frontOfficeRole", "clubId", "dateOfBirth", "nationalityId", "phoneNumberId")
    VALUES ('finance.manager@club.com', '${HASH}', '재무관리팀장', 'finance_manager', 'FRONT_OFFICE', 'FINANCE_MANAGER', v_club_id, '1990-01-01', v_country_id, v_phone_id);
  END IF;

  -- Finance Staff
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'finance.staff@club.com') THEN
    INSERT INTO "PhoneNumber" (encrypted, iv) VALUES ('dummy_finance_staff', 'dummy') RETURNING id INTO v_phone_id;
    INSERT INTO "User" (email, password, username, nickname, role, "frontOfficeRole", "clubId", "dateOfBirth", "nationalityId", "phoneNumberId")
    VALUES ('finance.staff@club.com', '${HASH}', '재무직원', 'finance_staff', 'FRONT_OFFICE', 'FINANCE_STAFF', v_club_id, '1990-01-01', v_country_id, v_phone_id);
  END IF;

  -- Facility Manager
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'facility.manager@club.com') THEN
    INSERT INTO "PhoneNumber" (encrypted, iv) VALUES ('dummy_fac_mgr', 'dummy') RETURNING id INTO v_phone_id;
    INSERT INTO "User" (email, password, username, nickname, role, "frontOfficeRole", "clubId", "dateOfBirth", "nationalityId", "phoneNumberId")
    VALUES ('facility.manager@club.com', '${HASH}', '시설관리팀장', 'facility_manager', 'FRONT_OFFICE', 'FACILITY_MANAGER', v_club_id, '1990-01-01', v_country_id, v_phone_id);
  END IF;

  -- Facility Staff
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'facility.staff@club.com') THEN
    INSERT INTO "PhoneNumber" (encrypted, iv) VALUES ('dummy_fac_staff', 'dummy') RETURNING id INTO v_phone_id;
    INSERT INTO "User" (email, password, username, nickname, role, "frontOfficeRole", "clubId", "dateOfBirth", "nationalityId", "phoneNumberId")
    VALUES ('facility.staff@club.com', '${HASH}', '시설관리직원', 'facility_staff', 'FRONT_OFFICE', 'FACILITY_STAFF', v_club_id, '1990-01-01', v_country_id, v_phone_id);
  END IF;

END $seed$;
`;

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  try {
    await client.query(seedSql);
    console.log('[repair-db] seed done');
  } catch (e) {
    console.error('[repair-db] seed error:', e.message);
  } finally {
    await client.end();
  }
}
main();
