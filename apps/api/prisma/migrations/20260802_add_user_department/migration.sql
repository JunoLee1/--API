CREATE TYPE "DeptRole" AS ENUM ('MANAGER', 'MEMBER');

CREATE TABLE "UserDepartment" (
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
