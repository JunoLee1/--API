DO $$ BEGIN
  CREATE TYPE "DeptRole" AS ENUM ('MANAGER', 'MEMBER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "UserDepartment" (
  "userId"       INTEGER NOT NULL,
  "departmentId" INTEGER NOT NULL,
  "role"         "DeptRole" NOT NULL DEFAULT 'MEMBER',
  "joinedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserDepartment_pkey" PRIMARY KEY ("userId", "departmentId"),
  CONSTRAINT "UserDepartment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserDepartment_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
