import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role, Status } from "../src/generated/client";
import * as bcrypt from "bcrypt";
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


const hashed = await bcrypt.hash("12345678",10)
async function main() {
  const Korea = await prisma.country.upsert({
    where: {
      code: "KR",
    },
    update: {},
    create: {
      code: "KR",
      name: "South Korea",
    },
  });
  const KPL = await prisma.league.upsert({
    where: {
      id: 1,
    },
    update: {},
    create: {
      name: "KPL",
      nation: {
        connect: {
          code: "KR",
        },
      },
    },
  });
  const Busan = await prisma.team.upsert({
    where: {
      id: 1,
    },
    update: {},
    create: {
      team_name: "Busan FC",
      short_name: "BUS",
      founded: new Date("2000-01-01"),

      league: {
        connect: { id: 1 },
      },
    },
  });
  const phone = await prisma.phoneNumber.create({
    data: {
      iv: "acd",
      encrypted: "01011112222",
    },
  });
  const Junmo = await prisma.user.upsert({
    where: {
      email: "junmo@test.com",
    },
    update: {},
    create: {
      id: 1,
      email: "junmo@test.com",
      password: hashed,
      username: "이준모",
      countryId:1,
      isDeleted: false,
      status: Status.ACTIVE,
      date_of_birth: new Date("1996-08-16"),
      phoneNumberId:1,
      nickname: "JM",
      teamId:1,
      role: "SUPER_ADVISOR",
    },
  });
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
