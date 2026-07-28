import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/client";
import bcrypt from "bcrypt";
import crypto from "crypto";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

const tr = (s: number, a: number) => Math.round((s / a) * 1000) / 10;

function encryptPhone(text: string) {
  const key = Buffer.from(process.env["PHONE_ENCRYPTION_KEY"]!, "hex");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf-8", "hex");
  encrypted += cipher.final("hex");
  return { encrypted, iv: iv.toString("hex") };
}

async function main() {
  console.log("🌱 Seeding...");

  // ── Team ─────────────────────────────────────────────
  const firstTeam = await prisma.team.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: '1군',
      type: 'FIRST_TEAM',
      ageGroup: null,
      isActive: true,
      trackStats: true,
      requiresContract: true,
    },
  });
  console.log('Seeded FIRST_TEAM:', firstTeam.id);

  // ── Country ──────────────────────────────────────────
  const korea = await prisma.country.upsert({
    where: { id: 1 },
    update: {},
    create: { name: "대한민국", code: "KR" },
  });
  const brazil = await prisma.country.upsert({
    where: { id: 2 },
    update: {},
    create: { name: "브라질", code: "BR" },
  });

  // ── Users ─────────────────────────────────────────────
  const adminPhone    = await prisma.phoneNumber.create({ data: encryptPhone("010-0000-0001") });
  const coachPhone    = await prisma.phoneNumber.create({ data: encryptPhone("010-0000-0002") });
  const foPhone       = await prisma.phoneNumber.create({ data: encryptPhone("010-0000-0003") });
  const playerPhone   = await prisma.phoneNumber.create({ data: encryptPhone("010-0000-0004") });
  const assistPhone   = await prisma.phoneNumber.create({ data: encryptPhone("010-0000-0005") });
  const defPhone      = await prisma.phoneNumber.create({ data: encryptPhone("010-0000-0006") });
  const atkPhone      = await prisma.phoneNumber.create({ data: encryptPhone("010-0000-0007") });
  const physPhone     = await prisma.phoneNumber.create({ data: encryptPhone("010-0000-0008") });
  const setPhone      = await prisma.phoneNumber.create({ data: encryptPhone("010-0000-0009") });
  const gkPhone       = await prisma.phoneNumber.create({ data: encryptPhone("010-0000-0010") });
  const medPhone      = await prisma.phoneNumber.create({ data: encryptPhone("010-0000-0011") });
  const meddirPhone   = await prisma.phoneNumber.create({ data: encryptPhone("010-0000-0012") });
  const gmPhone       = await prisma.phoneNumber.create({ data: encryptPhone("010-0000-0013") });
  const tdPhone       = await prisma.phoneNumber.create({ data: encryptPhone("010-0000-0014") });

  const hashed = await bcrypt.hash("Password1!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@club.com" },
    update: {},
    create: {
      email: "admin@club.com",
      password: hashed,
      username: "관리자",
      nickname: "admin",
      role: "ADMIN",
      dateOfBirth: new Date("1980-01-01"),
      nationalityId: korea.id,
      phoneNumberId: adminPhone.id,
    },
  });

  const coach = await prisma.user.upsert({
    where: { email: "coach@club.com" },
    update: {},
    create: {
      email: "coach@club.com",
      password: hashed,
      username: "수석코치",
      nickname: "headcoach",
      role: "COACHING_STAFF",
      coachingRole: "HEAD_COACH",
      dateOfBirth: new Date("1975-06-15"),
      nationalityId: korea.id,
      phoneNumberId: coachPhone.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "assistant@club.com" },
    update: {},
    create: {
      email: "assistant@club.com",
      password: hashed,
      username: "수석코치보",
      nickname: "assistant",
      role: "COACHING_STAFF",
      coachingRole: "ASSISTANT_COACH",
      dateOfBirth: new Date("1978-03-10"),
      nationalityId: korea.id,
      phoneNumberId: assistPhone.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "defensive@club.com" },
    update: {},
    create: {
      email: "defensive@club.com",
      password: hashed,
      username: "수비코치",
      nickname: "defcoach",
      role: "COACHING_STAFF",
      coachingRole: "DEFENSIVE_COACH",
      dateOfBirth: new Date("1976-08-22"),
      nationalityId: korea.id,
      phoneNumberId: defPhone.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "attacking@club.com" },
    update: {},
    create: {
      email: "attacking@club.com",
      password: hashed,
      username: "공격코치",
      nickname: "atkcoach",
      role: "COACHING_STAFF",
      coachingRole: "ATTACKING_COACH",
      dateOfBirth: new Date("1979-05-14"),
      nationalityId: korea.id,
      phoneNumberId: atkPhone.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "physical@club.com" },
    update: {},
    create: {
      email: "physical@club.com",
      password: hashed,
      username: "피지컬코치",
      nickname: "physcoach",
      role: "COACHING_STAFF",
      coachingRole: "PHYSICAL_COACH",
      dateOfBirth: new Date("1982-11-03"),
      nationalityId: korea.id,
      phoneNumberId: physPhone.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "setpiece@club.com" },
    update: {},
    create: {
      email: "setpiece@club.com",
      password: hashed,
      username: "세트피스코치",
      nickname: "setcoach",
      role: "COACHING_STAFF",
      coachingRole: "SET_PIECE_COACH",
      dateOfBirth: new Date("1981-02-28"),
      nationalityId: korea.id,
      phoneNumberId: setPhone.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "gk@club.com" },
    update: {},
    create: {
      email: "gk@club.com",
      password: hashed,
      username: "골키퍼코치",
      nickname: "gkcoach",
      role: "COACHING_STAFF",
      coachingRole: "GOALKEEPER_COACH",
      dateOfBirth: new Date("1977-09-17"),
      nationalityId: korea.id,
      phoneNumberId: gkPhone.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "medical@club.com" },
    update: {},
    create: {
      email: "medical@club.com",
      password: hashed,
      username: "의료진",
      nickname: "medical",
      role: "COACHING_STAFF",
      coachingRole: "MEDICAL",
      dateOfBirth: new Date("1983-06-05"),
      nationalityId: korea.id,
      phoneNumberId: medPhone.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "meddir@club.com" },
    update: {},
    create: {
      email: "meddir@club.com",
      password: hashed,
      username: "메디컬팀장",
      nickname: "meddir",
      role: "COACHING_STAFF",
      coachingRole: "MEDICAL_DIRECTOR",
      dateOfBirth: new Date("1974-12-20"),
      nationalityId: korea.id,
      phoneNumberId: meddirPhone.id,
    },
  });

  const frontOffice = await prisma.user.upsert({
    where: { email: "fo@club.com" },
    update: { frontOfficeRole: "SCOUT" },
    create: {
      email: "fo@club.com",
      password: hashed,
      username: "프런트",
      nickname: "frontoffice",
      role: "FRONT_OFFICE",
      frontOfficeRole: "SCOUT",
      dateOfBirth: new Date("1985-03-20"),
      nationalityId: korea.id,
      phoneNumberId: foPhone.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "gm@club.com" },
    update: { frontOfficeRole: "GM" },
    create: {
      email: "gm@club.com",
      password: hashed,
      username: "단장",
      nickname: "gm",
      role: "FRONT_OFFICE",
      frontOfficeRole: "GM",
      dateOfBirth: new Date("1970-05-10"),
      nationalityId: korea.id,
      phoneNumberId: gmPhone.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "td@club.com" },
    update: { frontOfficeRole: "TD" },
    create: {
      email: "td@club.com",
      password: hashed,
      username: "기술이사",
      nickname: "td",
      role: "FRONT_OFFICE",
      frontOfficeRole: "TD",
      dateOfBirth: new Date("1972-09-25"),
      nationalityId: korea.id,
      phoneNumberId: tdPhone.id,
    },
  });

  const playerUser = await prisma.user.upsert({
    where: { email: "player@club.com" },
    update: {},
    create: {
      email: "player@club.com",
      password: hashed,
      username: "선수",
      nickname: "player",
      role: "PLAYER",
      dateOfBirth: new Date("1998-07-01"),
      nationalityId: korea.id,
      phoneNumberId: playerPhone.id,
    },
  });

  // ── Season ────────────────────────────────────────────
  const season = await prisma.season.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "2026 시즌",
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-11-30"),
      status: "ACTIVE",
    },
  });

  // ── Players ───────────────────────────────────────────
  const p1 = await prisma.player.upsert({
    where: { id: "player-001" },
    update: {},
    create: {
      id: "player-001",
      playerName: "김민준",
      dateOfBirth: new Date("2000-04-12"),
      preferredFoot: "RIGHT",
      height: 183,
      weight: 76,
      position: "STRIKER",
      level: "SENIOR",
      status: "ACTIVE",
      nationalityId: korea.id,
    },
  });

  const p2 = await prisma.player.upsert({
    where: { id: "player-002" },
    update: {},
    create: {
      id: "player-002",
      playerName: "이서준",
      dateOfBirth: new Date("1998-09-22"),
      preferredFoot: "LEFT",
      height: 179,
      weight: 72,
      position: "CENTRAL_ATTACK_MIDFIELDER",
      level: "VETERAN",
      status: "ACTIVE",
      nationalityId: korea.id,
    },
  });

  const p3 = await prisma.player.upsert({
    where: { id: "player-003" },
    update: {},
    create: {
      id: "player-003",
      playerName: "Carlos Silva",
      dateOfBirth: new Date("2002-01-07"),
      preferredFoot: "RIGHT",
      height: 176,
      weight: 70,
      position: "WINGER",
      level: "ROOKIE",
      status: "ACTIVE",
      nationalityId: brazil.id,
    },
  });

  const p4 = await prisma.player.upsert({
    where: { id: "player-004" },
    update: {},
    create: {
      id: "player-004",
      playerName: "박지훈",
      dateOfBirth: new Date("1997-11-30"),
      preferredFoot: "RIGHT",
      height: 188,
      weight: 82,
      position: "GOALKEEPER",
      level: "SENIOR",
      status: "ACTIVE",
      nationalityId: korea.id,
    },
  });

  const p5 = await prisma.player.upsert({
    where: { id: "player-005" },
    update: {},
    create: {
      id: "player-005",
      playerName: "정현우",
      dateOfBirth: new Date("2001-07-18"),
      preferredFoot: "BOTH",
      height: 181,
      weight: 74,
      position: "CENTER_BACK",
      level: "SENIOR",
      status: "ACTIVE",
      nationalityId: korea.id,
    },
  });

  const p6 = await prisma.player.upsert({
    where: { id: "player-006" },
    update: {},
    create: {
      id: "player-006",
      playerName: "최재원",
      dateOfBirth: new Date("1995-02-14"),
      preferredFoot: "RIGHT",
      height: 187,
      weight: 81,
      position: "CENTER_BACK",
      level: "VETERAN",
      status: "ACTIVE",
      nationalityId: korea.id,
    },
  });

  const p7 = await prisma.player.upsert({
    where: { id: "player-007" },
    update: {},
    create: {
      id: "player-007",
      playerName: "한동민",
      dateOfBirth: new Date("2000-08-05"),
      preferredFoot: "LEFT",
      height: 176,
      weight: 70,
      position: "LEFT_FULL_BACK",
      level: "SENIOR",
      status: "ACTIVE",
      nationalityId: korea.id,
    },
  });

  const p8 = await prisma.player.upsert({
    where: { id: "player-008" },
    update: {},
    create: {
      id: "player-008",
      playerName: "오승환",
      dateOfBirth: new Date("1999-05-21"),
      preferredFoot: "RIGHT",
      height: 178,
      weight: 73,
      position: "RIGHT_FULL_BACK",
      level: "SENIOR",
      status: "ACTIVE",
      nationalityId: korea.id,
    },
  });

  const p9 = await prisma.player.upsert({
    where: { id: "player-009" },
    update: {},
    create: {
      id: "player-009",
      playerName: "김태영",
      dateOfBirth: new Date("1994-11-08"),
      preferredFoot: "RIGHT",
      height: 182,
      weight: 78,
      position: "CENTRAL_DEFENSIVE_MIDFIELDER",
      level: "VETERAN",
      status: "ACTIVE",
      nationalityId: korea.id,
    },
  });

  const p10 = await prisma.player.upsert({
    where: { id: "player-010" },
    update: {},
    create: {
      id: "player-010",
      playerName: "류현진",
      dateOfBirth: new Date("2001-03-30"),
      preferredFoot: "RIGHT",
      height: 180,
      weight: 75,
      position: "CENTRAL_DEFENSIVE_MIDFIELDER",
      level: "SENIOR",
      status: "ACTIVE",
      nationalityId: korea.id,
    },
  });

  const p11 = await prisma.player.upsert({
    where: { id: "player-011" },
    update: {},
    create: {
      id: "player-011",
      playerName: "박상원",
      dateOfBirth: new Date("1999-09-15"),
      preferredFoot: "RIGHT",
      height: 177,
      weight: 71,
      position: "LEFT_ATTACK_MIDFIELDER",
      level: "SENIOR",
      status: "ACTIVE",
      nationalityId: korea.id,
    },
  });

  const p12 = await prisma.player.upsert({
    where: { id: "player-012" },
    update: {},
    create: {
      id: "player-012",
      playerName: "윤대성",
      dateOfBirth: new Date("1997-06-02"),
      preferredFoot: "BOTH",
      height: 174,
      weight: 68,
      position: "RIGHT_ATTACK_MIDFIELDER",
      level: "SENIOR",
      status: "ACTIVE",
      nationalityId: korea.id,
    },
  });

  const p13 = await prisma.player.upsert({
    where: { id: "player-013" },
    update: {},
    create: {
      id: "player-013",
      playerName: "이강인",
      dateOfBirth: new Date("2003-01-19"),
      preferredFoot: "LEFT",
      height: 173,
      weight: 66,
      position: "WINGER",
      level: "ROOKIE",
      status: "ACTIVE",
      nationalityId: korea.id,
    },
  });

  const p14 = await prisma.player.upsert({
    where: { id: "player-014" },
    update: {},
    create: {
      id: "player-014",
      playerName: "황희찬",
      dateOfBirth: new Date("1996-01-26"),
      preferredFoot: "RIGHT",
      height: 177,
      weight: 72,
      position: "SHADOW_STRIKER",
      level: "VETERAN",
      status: "ACTIVE",
      nationalityId: korea.id,
    },
  });

  const p15 = await prisma.player.upsert({
    where: { id: "player-015" },
    update: {},
    create: {
      id: "player-015",
      playerName: "조현우",
      dateOfBirth: new Date("1991-09-25"),
      preferredFoot: "RIGHT",
      height: 189,
      weight: 83,
      position: "GOALKEEPER",
      level: "VETERAN",
      status: "ACTIVE",
      nationalityId: korea.id,
    },
  });

  await prisma.player.upsert({
    where: { id: "player-016" },
    update: {},
    create: {
      id: "player-016",
      playerName: "권창훈",
      dateOfBirth: new Date("1994-09-30"),
      preferredFoot: "RIGHT",
      height: 175,
      weight: 70,
      position: "WINGER",
      level: "VETERAN",
      status: "ACTIVE",
      nationalityId: korea.id,
    },
  });

  await prisma.player.upsert({
    where: { id: "player-017" },
    update: {},
    create: {
      id: "player-017",
      playerName: "이재성",
      dateOfBirth: new Date("1992-08-10"),
      preferredFoot: "RIGHT",
      height: 178,
      weight: 74,
      position: "CENTRAL_ATTACK_MIDFIELDER",
      level: "VETERAN",
      status: "ACTIVE",
      nationalityId: korea.id,
    },
  });

  await prisma.player.upsert({
    where: { id: "player-018" },
    update: {},
    create: {
      id: "player-018",
      playerName: "송민규",
      dateOfBirth: new Date("1999-09-12"),
      preferredFoot: "BOTH",
      height: 174,
      weight: 68,
      position: "STRIKER",
      level: "SENIOR",
      status: "ACTIVE",
      nationalityId: korea.id,
    },
  });

  await prisma.player.upsert({
    where: { id: "player-019" },
    update: {},
    create: {
      id: "player-019",
      playerName: "Mateus Costa",
      dateOfBirth: new Date("2000-11-14"),
      preferredFoot: "LEFT",
      height: 171,
      weight: 65,
      position: "LEFT_DEFENSIVE_MIDFIELDER",
      level: "ROOKIE",
      status: "ACTIVE",
      nationalityId: brazil.id,
    },
  });

  await prisma.player.upsert({
    where: { id: "player-020" },
    update: {},
    create: {
      id: "player-020",
      playerName: "김영권",
      dateOfBirth: new Date("1990-02-27"),
      preferredFoot: "RIGHT",
      height: 185,
      weight: 80,
      position: "CENTER_BACK",
      level: "VETERAN",
      status: "ACTIVE",
      nationalityId: korea.id,
    },
  });

  // ── Contracts ─────────────────────────────────────────
  const contract1 = await prisma.contract.upsert({
    where: { id: 1 },
    update: {},
    create: {
      playerId: p1.id,
      startDate: new Date("2025-01-01"),
      endDate: new Date("2027-12-31"),
      salary: 50_000_000,
      status: "ACTIVE",
      managedById: frontOffice.id,
    },
  });

  await prisma.contract.upsert({
    where: { id: 2 },
    update: {},
    create: {
      playerId: p2.id,
      startDate: new Date("2024-07-01"),
      endDate: new Date("2026-06-30"),
      salary: 80_000_000,
      status: "ACTIVE",
      managedById: frontOffice.id,
    },
  });

  await prisma.contract.upsert({
    where: { id: 3 },
    update: {},
    create: {
      playerId: p3.id,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2028-12-31"),
      salary: 30_000_000,
      status: "ACTIVE",
      managedById: frontOffice.id,
    },
  });

  // BuyoutClause for contract1
  await prisma.buyoutClause.upsert({
    where: { contractId: contract1.id },
    update: {},
    create: { contractId: contract1.id, amount: BigInt(5_000_000_000) },
  });

  // ── Matches ───────────────────────────────────────────
  const match1 = await prisma.match.upsert({
    where: { id: 1 },
    update: {},
    create: {
      date: new Date("2026-04-05T15:00:00"),
      homeTeamName: "FC Seoul",
      awayTeamName: "Busan IPark",
      homeScore: 3,
      awayScore: 1,
      competitionType: "LEAGUE",
      seasonId: season.id,
    },
  });

  const match2 = await prisma.match.upsert({
    where: { id: 2 },
    update: {},
    create: {
      date: new Date("2026-04-19T14:00:00"),
      homeTeamName: "Incheon United",
      awayTeamName: "FC Seoul",
      homeScore: 0,
      awayScore: 2,
      competitionType: "LEAGUE",
      seasonId: season.id,
    },
  });

  // ── Additional Matches (2026 시즌 일정) ───────────────
  await prisma.match.upsert({
    where: { id: 3 },
    update: {},
    create: {
      date: new Date("2026-05-03T14:00:00"),
      homeTeamName: "FC Seoul",
      awayTeamName: "Suwon Samsung Bluewings",
      homeScore: 1,
      awayScore: 1,
      competitionType: "LEAGUE",
      seasonId: season.id,
    },
  });

  await prisma.match.upsert({
    where: { id: 4 },
    update: {},
    create: {
      date: new Date("2026-05-17T16:00:00"),
      homeTeamName: "Jeonbuk Hyundai Motors",
      awayTeamName: "FC Seoul",
      homeScore: 2,
      awayScore: 0,
      competitionType: "LEAGUE",
      seasonId: season.id,
    },
  });

  await prisma.match.upsert({
    where: { id: 5 },
    update: {},
    create: {
      date: new Date("2026-06-07T19:00:00"),
      homeTeamName: "FC Seoul",
      awayTeamName: "Daegu FC",
      homeScore: 2,
      awayScore: 1,
      competitionType: "LEAGUE",
      seasonId: season.id,
    },
  });

  await prisma.match.upsert({
    where: { id: 6 },
    update: {},
    create: {
      date: new Date("2026-06-21T19:00:00"),
      homeTeamName: "Ulsan HD",
      awayTeamName: "FC Seoul",
      homeScore: 3,
      awayScore: 1,
      competitionType: "LEAGUE",
      seasonId: season.id,
    },
  });

  await prisma.match.upsert({
    where: { id: 7 },
    update: {},
    create: {
      date: new Date("2026-07-05T19:00:00"),
      homeTeamName: "FC Seoul",
      awayTeamName: "Pohang Steelers",
      homeScore: 0,
      awayScore: 0,
      competitionType: "LEAGUE",
      seasonId: season.id,
    },
  });

  await prisma.match.upsert({
    where: { id: 8 },
    update: {},
    create: {
      date: new Date("2026-07-12T14:00:00"),
      homeTeamName: "FC Seoul",
      awayTeamName: "Gangwon FC",
      homeScore: 3,
      awayScore: 0,
      competitionType: "DOMESTIC_CUP",
      seasonId: season.id,
    },
  });

  await prisma.match.upsert({
    where: { id: 9 },
    update: {},
    create: {
      date: new Date("2026-07-26T19:00:00"),
      homeTeamName: "Seongnam FC",
      awayTeamName: "FC Seoul",
      competitionType: "LEAGUE",
      seasonId: season.id,
    },
  });

  await prisma.match.upsert({
    where: { id: 10 },
    update: {},
    create: {
      date: new Date("2026-08-09T19:00:00"),
      homeTeamName: "FC Seoul",
      awayTeamName: "Gimcheon Sangmu",
      competitionType: "LEAGUE",
      seasonId: season.id,
    },
  });

  await prisma.match.upsert({
    where: { id: 11 },
    update: {},
    create: {
      date: new Date("2026-08-23T16:00:00"),
      homeTeamName: "Jeju United",
      awayTeamName: "FC Seoul",
      competitionType: "LEAGUE",
      seasonId: season.id,
    },
  });

  await prisma.match.upsert({
    where: { id: 12 },
    update: {},
    create: {
      date: new Date("2026-09-06T19:00:00"),
      homeTeamName: "FC Seoul",
      awayTeamName: "Jeonbuk Hyundai Motors",
      competitionType: "LEAGUE",
      seasonId: season.id,
    },
  });

  // MatchSquad — match1 (스코어 있는 경기는 일괄 처리)
  await prisma.matchSquad.createMany({
    data: [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15].map((p) => ({
      matchId: match1.id,
      playerId: p.id,
      isConfirmed: true,
    })),
    skipDuplicates: true,
  });

  // PlayerMatchStats — match1
  await prisma.playerMatchStats.upsert({
    where: { id: 1 },
    update: { passesAttempted: 32, passesCompleted: 26, xA: 0.65, shotsOnTarget: 3 },
    create: {
      matchId: match1.id,
      playerId: p1.id,
      goals: 2,
      assists: 1,
      xG: 2.3,
      xA: 0.65,
      shots: 5,
      shotsOnTarget: 3,
      passesAttempted: 32,
      passesCompleted: 26,
      minutesPlayed: 90,
    },
  });

  await prisma.playerMatchStats.upsert({
    where: { id: 2 },
    update: { passesAttempted: 72, passesCompleted: 64, shotsOnTarget: 1 },
    create: {
      matchId: match1.id,
      playerId: p2.id,
      goals: 1,
      assists: 2,
      keyPasses: 4,
      shotsOnTarget: 1,
      passesAttempted: 72,
      passesCompleted: 64,
      minutesPlayed: 90,
    },
  });

  // match2: Incheon 0-2 FC Seoul (원정승) — p1 2골
  await prisma.playerMatchStats.upsert({
    where: { id: 3 },
    update: { passesAttempted: 29, passesCompleted: 23, shotsOnTarget: 3 },
    create: { matchId: 2, playerId: p1.id, goals: 2, assists: 0, xG: 1.9, shots: 4, shotsOnTarget: 3, passesAttempted: 29, passesCompleted: 23, minutesPlayed: 90 },
  });
  await prisma.playerMatchStats.upsert({
    where: { id: 4 },
    update: { passesAttempted: 30, passesCompleted: 25, xA: 0.9 },
    create: { matchId: 2, playerId: p3.id, goals: 0, assists: 2, xG: 0.4, xA: 0.9, shots: 2, shotsOnTarget: 1, passesAttempted: 30, passesCompleted: 25, minutesPlayed: 90 },
  });

  // match3: FC Seoul 1-1 Suwon — p2 1골
  await prisma.playerMatchStats.upsert({
    where: { id: 5 },
    update: { passesAttempted: 68, passesCompleted: 59, shotsOnTarget: 2 },
    create: { matchId: 3, playerId: p2.id, goals: 1, assists: 0, xG: 1.1, shots: 3, shotsOnTarget: 2, passesAttempted: 68, passesCompleted: 59, minutesPlayed: 90 },
  });
  await prisma.playerMatchStats.upsert({
    where: { id: 6 },
    update: { passesAttempted: 28, passesCompleted: 22, xA: 0.55 },
    create: { matchId: 3, playerId: p1.id, goals: 0, assists: 1, xG: 0.6, xA: 0.55, shots: 3, shotsOnTarget: 1, passesAttempted: 28, passesCompleted: 22, minutesPlayed: 82 },
  });

  // match4: Jeonbuk 2-0 FC Seoul (원정패) — 무득점
  await prisma.playerMatchStats.upsert({
    where: { id: 7 },
    update: { passesAttempted: 31, passesCompleted: 24 },
    create: { matchId: 4, playerId: p1.id, goals: 0, assists: 0, xG: 0.5, shots: 2, shotsOnTarget: 1, passesAttempted: 31, passesCompleted: 24, minutesPlayed: 90 },
  });
  await prisma.playerMatchStats.upsert({
    where: { id: 8 },
    update: { passesAttempted: 49, passesCompleted: 43 },
    create: { matchId: 4, playerId: p5.id, goals: 0, assists: 0, xG: 0.2, shots: 1, shotsOnTarget: 0, passesAttempted: 49, passesCompleted: 43, minutesPlayed: 90 },
  });

  // match5: FC Seoul 2-1 Daegu — p1 1골, p3 1골
  await prisma.playerMatchStats.upsert({
    where: { id: 9 },
    update: { passesAttempted: 30, passesCompleted: 24, shotsOnTarget: 2 },
    create: { matchId: 5, playerId: p1.id, goals: 1, assists: 0, xG: 1.4, shots: 4, shotsOnTarget: 2, passesAttempted: 30, passesCompleted: 24, minutesPlayed: 90 },
  });
  await prisma.playerMatchStats.upsert({
    where: { id: 10 },
    update: { passesAttempted: 28, passesCompleted: 23, shotsOnTarget: 2 },
    create: { matchId: 5, playerId: p3.id, goals: 1, assists: 0, xG: 0.9, shots: 3, shotsOnTarget: 2, passesAttempted: 28, passesCompleted: 23, minutesPlayed: 90 },
  });
  await prisma.playerMatchStats.upsert({
    where: { id: 11 },
    update: { passesAttempted: 70, passesCompleted: 62 },
    create: { matchId: 5, playerId: p2.id, goals: 0, assists: 2, xG: 0.3, keyPasses: 5, shotsOnTarget: 1, passesAttempted: 70, passesCompleted: 62, minutesPlayed: 90 },
  });

  // match6: Ulsan 3-1 FC Seoul (원정패) — p2 1골
  await prisma.playerMatchStats.upsert({
    where: { id: 12 },
    update: { passesAttempted: 60, passesCompleted: 52, shotsOnTarget: 1 },
    create: { matchId: 6, playerId: p2.id, goals: 1, assists: 0, xG: 0.8, shots: 2, shotsOnTarget: 1, passesAttempted: 60, passesCompleted: 52, minutesPlayed: 90 },
  });
  await prisma.playerMatchStats.upsert({
    where: { id: 13 },
    update: { passesAttempted: 27, passesCompleted: 21, xA: 0.5 },
    create: { matchId: 6, playerId: p1.id, goals: 0, assists: 1, xG: 0.7, xA: 0.5, shots: 3, shotsOnTarget: 1, passesAttempted: 27, passesCompleted: 21, minutesPlayed: 90 },
  });

  // match7: FC Seoul 0-0 Pohang — 무득점
  await prisma.playerMatchStats.upsert({
    where: { id: 14 },
    update: { passesAttempted: 33, passesCompleted: 26 },
    create: { matchId: 7, playerId: p1.id, goals: 0, assists: 0, xG: 0.4, shots: 2, shotsOnTarget: 0, passesAttempted: 33, passesCompleted: 26, minutesPlayed: 90 },
  });

  // match8: FC Seoul 3-0 Gangwon FA컵 — p1 2골, p2 1골
  await prisma.playerMatchStats.upsert({
    where: { id: 15 },
    update: { passesAttempted: 35, passesCompleted: 29, shotsOnTarget: 3 },
    create: { matchId: 8, playerId: p1.id, goals: 2, assists: 0, xG: 2.1, shots: 5, shotsOnTarget: 3, passesAttempted: 35, passesCompleted: 29, minutesPlayed: 90 },
  });
  await prisma.playerMatchStats.upsert({
    where: { id: 16 },
    update: { passesAttempted: 73, passesCompleted: 65, shotsOnTarget: 2 },
    create: { matchId: 8, playerId: p2.id, goals: 1, assists: 1, xG: 1.0, shots: 3, shotsOnTarget: 2, passesAttempted: 73, passesCompleted: 65, minutesPlayed: 90 },
  });
  await prisma.playerMatchStats.upsert({
    where: { id: 17 },
    update: { passesAttempted: 32, passesCompleted: 27 },
    create: { matchId: 8, playerId: p3.id, goals: 0, assists: 2, xG: 0.5, shots: 2, shotsOnTarget: 1, passesAttempted: 32, passesCompleted: 27, minutesPlayed: 90 },
  });

  // ── PlayerMatchStats (추가 — 스타팅 XI 전원) ─────────────

  // match1 additions: 3-1 홈승
  await prisma.playerMatchStats.upsert({ where: { id: 18 }, update: {}, create: { matchId: match1.id, playerId: p3.id,  shots: 3, xG: 0.7,  keyPasses: 2, shotsOnTarget: 1, passesAttempted: 28, passesCompleted: 23, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 19 }, update: { passesAttempted: 52, passesCompleted: 46 }, create: { matchId: match1.id, playerId: p5.id,  tackles: 4, interceptions: 2, clearances: 5, passesAttempted: 52, passesCompleted: 46, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 20 }, update: { passesAttempted: 55, passesCompleted: 49 }, create: { matchId: match1.id, playerId: p6.id,  tackles: 5, interceptions: 3, clearances: 7, passesAttempted: 55, passesCompleted: 49, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 21 }, update: {}, create: { matchId: match1.id, playerId: p7.id,  tackles: 3, interceptions: 2, clearances: 2, passesAttempted: 51, passesCompleted: 44, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 22 }, update: {}, create: { matchId: match1.id, playerId: p8.id,  tackles: 2, interceptions: 1, clearances: 1, passesAttempted: 46, passesCompleted: 39, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 23 }, update: {}, create: { matchId: match1.id, playerId: p9.id,  tackles: 6, interceptions: 4, passesAttempted: 70, passesCompleted: 62, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 24 }, update: {}, create: { matchId: match1.id, playerId: p10.id, tackles: 4, interceptions: 3, passesAttempted: 58, passesCompleted: 50, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 25 }, update: { passesAttempted: 24, passesCompleted: 20 }, create: { matchId: match1.id, playerId: p13.id, shots: 2, xG: 0.4, keyPasses: 1, shotsOnTarget: 1, passesAttempted: 24, passesCompleted: 20, minutesPlayed: 72 } });
  await prisma.playerMatchStats.upsert({ where: { id: 26 }, update: { passesAttempted: 7, passesCompleted: 5 }, create: { matchId: match1.id, playerId: p14.id, shots: 1, xG: 0.3, shotsOnTarget: 0, passesAttempted: 7, passesCompleted: 5, minutesPlayed: 18 } });
  await prisma.playerMatchStats.upsert({ where: { id: 27 }, update: { passesAttempted: 32, passesCompleted: 29 }, create: { matchId: match1.id, playerId: p15.id, saves: 3, cleanSheet: false, passesAttempted: 32, passesCompleted: 29, minutesPlayed: 90 } });

  // match2 additions: Incheon 0-2 FC Seoul 원정승
  await prisma.playerMatchStats.upsert({ where: { id: 28 }, update: {}, create: { matchId: 2, playerId: p2.id,  shots: 1, xG: 0.3, keyPasses: 3, shotsOnTarget: 1, passesAttempted: 64, passesCompleted: 56, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 29 }, update: { passesAttempted: 48, passesCompleted: 43 }, create: { matchId: 2, playerId: p5.id,  tackles: 5, interceptions: 4, clearances: 6, passesAttempted: 48, passesCompleted: 43, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 30 }, update: { passesAttempted: 51, passesCompleted: 46 }, create: { matchId: 2, playerId: p6.id,  tackles: 6, interceptions: 5, clearances: 8, passesAttempted: 51, passesCompleted: 46, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 31 }, update: {}, create: { matchId: 2, playerId: p7.id,  tackles: 3, interceptions: 2, passesAttempted: 47, passesCompleted: 40, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 32 }, update: {}, create: { matchId: 2, playerId: p8.id,  tackles: 2, interceptions: 2, passesAttempted: 43, passesCompleted: 37, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 33 }, update: {}, create: { matchId: 2, playerId: p9.id,  tackles: 7, interceptions: 5, passesAttempted: 65, passesCompleted: 57, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 34 }, update: {}, create: { matchId: 2, playerId: p10.id, tackles: 5, interceptions: 4, passesAttempted: 54, passesCompleted: 47, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 35 }, update: { passesAttempted: 22, passesCompleted: 18 }, create: { matchId: 2, playerId: p13.id, shots: 1, xG: 0.3, shotsOnTarget: 0, passesAttempted: 22, passesCompleted: 18, minutesPlayed: 85 } });
  await prisma.playerMatchStats.upsert({ where: { id: 36 }, update: { passesAttempted: 28, passesCompleted: 25 }, create: { matchId: 2, playerId: p15.id, saves: 5, cleanSheet: true, passesAttempted: 28, passesCompleted: 25, minutesPlayed: 90 } });

  // match3 additions: FC Seoul 1-1 Suwon 홈무
  await prisma.playerMatchStats.upsert({ where: { id: 37 }, update: { passesAttempted: 26, passesCompleted: 22 }, create: { matchId: 3, playerId: p3.id,  shots: 2, xG: 0.5, keyPasses: 2, shotsOnTarget: 1, passesAttempted: 26, passesCompleted: 22, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 38 }, update: { passesAttempted: 50, passesCompleted: 44 }, create: { matchId: 3, playerId: p5.id,  tackles: 4, interceptions: 3, clearances: 6, passesAttempted: 50, passesCompleted: 44, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 39 }, update: { passesAttempted: 53, passesCompleted: 47 }, create: { matchId: 3, playerId: p6.id,  tackles: 5, interceptions: 4, clearances: 7, passesAttempted: 53, passesCompleted: 47, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 40 }, update: {}, create: { matchId: 3, playerId: p7.id,  tackles: 3, interceptions: 2, passesAttempted: 48, passesCompleted: 41, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 41 }, update: {}, create: { matchId: 3, playerId: p8.id,  tackles: 2, interceptions: 1, passesAttempted: 44, passesCompleted: 38, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 42 }, update: {}, create: { matchId: 3, playerId: p9.id,  tackles: 5, interceptions: 4, passesAttempted: 63, passesCompleted: 55, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 43 }, update: {}, create: { matchId: 3, playerId: p10.id, tackles: 4, interceptions: 3, passesAttempted: 52, passesCompleted: 45, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 44 }, update: { passesAttempted: 8, passesCompleted: 6 }, create: { matchId: 3, playerId: p11.id, shots: 1, xG: 0.2, keyPasses: 1, shotsOnTarget: 0, passesAttempted: 8, passesCompleted: 6, minutesPlayed: 20 } });
  await prisma.playerMatchStats.upsert({ where: { id: 45 }, update: { passesAttempted: 20, passesCompleted: 17 }, create: { matchId: 3, playerId: p13.id, shots: 2, xG: 0.4, shotsOnTarget: 1, passesAttempted: 20, passesCompleted: 17, minutesPlayed: 70 } });
  await prisma.playerMatchStats.upsert({ where: { id: 46 }, update: { passesAttempted: 30, passesCompleted: 27 }, create: { matchId: 3, playerId: p15.id, saves: 3, cleanSheet: false, passesAttempted: 30, passesCompleted: 27, minutesPlayed: 90 } });

  // match4 additions: Jeonbuk 2-0 FC Seoul 원정패
  await prisma.playerMatchStats.upsert({ where: { id: 47 }, update: {}, create: { matchId: 4, playerId: p2.id,  shots: 1, xG: 0.2, keyPasses: 2, shotsOnTarget: 0, passesAttempted: 58, passesCompleted: 48, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 48 }, update: { passesAttempted: 20, passesCompleted: 16 }, create: { matchId: 4, playerId: p3.id,  shots: 1, xG: 0.3, shotsOnTarget: 1, passesAttempted: 20, passesCompleted: 16, minutesPlayed: 75 } });
  await prisma.playerMatchStats.upsert({ where: { id: 49 }, update: { passesAttempted: 46, passesCompleted: 40 }, create: { matchId: 4, playerId: p6.id,  tackles: 5, interceptions: 4, clearances: 8, passesAttempted: 46, passesCompleted: 40, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 50 }, update: {}, create: { matchId: 4, playerId: p7.id,  tackles: 3, interceptions: 2, clearances: 3, passesAttempted: 44, passesCompleted: 37, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 51 }, update: {}, create: { matchId: 4, playerId: p8.id,  tackles: 2, interceptions: 2, clearances: 2, passesAttempted: 40, passesCompleted: 34, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 52 }, update: {}, create: { matchId: 4, playerId: p9.id,  tackles: 6, interceptions: 5, passesAttempted: 61, passesCompleted: 52, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 53 }, update: {}, create: { matchId: 4, playerId: p10.id, tackles: 5, interceptions: 3, passesAttempted: 50, passesCompleted: 43, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 54 }, update: { passesAttempted: 18, passesCompleted: 14 }, create: { matchId: 4, playerId: p13.id, shots: 1, xG: 0.2, shotsOnTarget: 0, passesAttempted: 18, passesCompleted: 14, minutesPlayed: 65 } });
  await prisma.playerMatchStats.upsert({ where: { id: 55 }, update: { passesAttempted: 25, passesCompleted: 22 }, create: { matchId: 4, playerId: p15.id, saves: 6, cleanSheet: false, passesAttempted: 25, passesCompleted: 22, minutesPlayed: 90 } });

  // match5 additions: FC Seoul 2-1 Daegu 홈승
  await prisma.playerMatchStats.upsert({ where: { id: 56 }, update: { passesAttempted: 51, passesCompleted: 45 }, create: { matchId: 5, playerId: p5.id,  tackles: 4, interceptions: 3, clearances: 5, passesAttempted: 51, passesCompleted: 45, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 57 }, update: { passesAttempted: 54, passesCompleted: 48 }, create: { matchId: 5, playerId: p6.id,  tackles: 5, interceptions: 3, clearances: 6, passesAttempted: 54, passesCompleted: 48, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 58 }, update: {}, create: { matchId: 5, playerId: p7.id,  tackles: 3, interceptions: 2, passesAttempted: 50, passesCompleted: 43, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 59 }, update: {}, create: { matchId: 5, playerId: p8.id,  tackles: 2, interceptions: 1, passesAttempted: 45, passesCompleted: 39, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 60 }, update: {}, create: { matchId: 5, playerId: p9.id,  tackles: 5, interceptions: 4, passesAttempted: 66, passesCompleted: 58, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 61 }, update: {}, create: { matchId: 5, playerId: p10.id, tackles: 4, interceptions: 3, passesAttempted: 55, passesCompleted: 48, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 62 }, update: { passesAttempted: 22, passesCompleted: 19 }, create: { matchId: 5, playerId: p13.id, shots: 1, xG: 0.3, shotsOnTarget: 0, passesAttempted: 22, passesCompleted: 19, minutesPlayed: 80 } });
  await prisma.playerMatchStats.upsert({ where: { id: 63 }, update: { passesAttempted: 31, passesCompleted: 28 }, create: { matchId: 5, playerId: p15.id, saves: 3, cleanSheet: false, passesAttempted: 31, passesCompleted: 28, minutesPlayed: 90 } });

  // match6 additions: Ulsan 3-1 FC Seoul 원정패
  await prisma.playerMatchStats.upsert({ where: { id: 64 }, update: { passesAttempted: 19, passesCompleted: 15 }, create: { matchId: 6, playerId: p3.id,  shots: 1, xG: 0.3, shotsOnTarget: 1, passesAttempted: 19, passesCompleted: 15, minutesPlayed: 75 } });
  await prisma.playerMatchStats.upsert({ where: { id: 65 }, update: { passesAttempted: 44, passesCompleted: 38 }, create: { matchId: 6, playerId: p5.id,  tackles: 5, interceptions: 3, clearances: 9, passesAttempted: 44, passesCompleted: 38, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 66 }, update: { passesAttempted: 47, passesCompleted: 41 }, create: { matchId: 6, playerId: p6.id,  tackles: 6, interceptions: 4, clearances: 10, passesAttempted: 47, passesCompleted: 41, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 67 }, update: {}, create: { matchId: 6, playerId: p7.id,  tackles: 4, interceptions: 3, clearances: 3, passesAttempted: 42, passesCompleted: 35, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 68 }, update: {}, create: { matchId: 6, playerId: p8.id,  tackles: 3, interceptions: 2, clearances: 2, passesAttempted: 38, passesCompleted: 32, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 69 }, update: {}, create: { matchId: 6, playerId: p9.id,  tackles: 7, interceptions: 5, passesAttempted: 60, passesCompleted: 51, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 70 }, update: {}, create: { matchId: 6, playerId: p10.id, tackles: 5, interceptions: 4, passesAttempted: 49, passesCompleted: 42, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 71 }, update: { passesAttempted: 17, passesCompleted: 13 }, create: { matchId: 6, playerId: p13.id, shots: 1, xG: 0.2, shotsOnTarget: 0, passesAttempted: 17, passesCompleted: 13, minutesPlayed: 60 } });
  await prisma.playerMatchStats.upsert({ where: { id: 72 }, update: { passesAttempted: 11, passesCompleted: 8 }, create: { matchId: 6, playerId: p14.id, shots: 2, xG: 0.5, shotsOnTarget: 1, passesAttempted: 11, passesCompleted: 8, minutesPlayed: 30 } });
  await prisma.playerMatchStats.upsert({ where: { id: 73 }, update: { passesAttempted: 26, passesCompleted: 23 }, create: { matchId: 6, playerId: p15.id, saves: 7, cleanSheet: false, passesAttempted: 26, passesCompleted: 23, minutesPlayed: 90 } });

  // match7 additions: FC Seoul 0-0 Pohang 홈무
  await prisma.playerMatchStats.upsert({ where: { id: 74 }, update: {}, create: { matchId: 7, playerId: p2.id,  shots: 1, xG: 0.3, keyPasses: 3, shotsOnTarget: 0, passesAttempted: 65, passesCompleted: 58, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 75 }, update: { passesAttempted: 27, passesCompleted: 23 }, create: { matchId: 7, playerId: p3.id,  shots: 2, xG: 0.5, shotsOnTarget: 1, passesAttempted: 27, passesCompleted: 23, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 76 }, update: { passesAttempted: 52, passesCompleted: 47 }, create: { matchId: 7, playerId: p5.id,  tackles: 5, interceptions: 4, clearances: 6, passesAttempted: 52, passesCompleted: 47, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 77 }, update: { passesAttempted: 55, passesCompleted: 50 }, create: { matchId: 7, playerId: p6.id,  tackles: 6, interceptions: 4, clearances: 7, passesAttempted: 55, passesCompleted: 50, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 78 }, update: {}, create: { matchId: 7, playerId: p7.id,  tackles: 4, interceptions: 3, passesAttempted: 50, passesCompleted: 44, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 79 }, update: {}, create: { matchId: 7, playerId: p8.id,  tackles: 3, interceptions: 2, passesAttempted: 46, passesCompleted: 40, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 80 }, update: {}, create: { matchId: 7, playerId: p9.id,  tackles: 6, interceptions: 5, passesAttempted: 68, passesCompleted: 61, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 81 }, update: {}, create: { matchId: 7, playerId: p10.id, tackles: 5, interceptions: 4, passesAttempted: 57, passesCompleted: 51, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 82 }, update: { passesAttempted: 25, passesCompleted: 22 }, create: { matchId: 7, playerId: p13.id, shots: 1, xG: 0.3, shotsOnTarget: 0, passesAttempted: 25, passesCompleted: 22, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 83 }, update: { passesAttempted: 33, passesCompleted: 30 }, create: { matchId: 7, playerId: p15.id, saves: 4, cleanSheet: true, passesAttempted: 33, passesCompleted: 30, minutesPlayed: 90 } });

  // match8 additions: FC Seoul 3-0 Gangwon FA컵 홈승
  await prisma.playerMatchStats.upsert({ where: { id: 84 }, update: { passesAttempted: 55, passesCompleted: 50 }, create: { matchId: 8, playerId: p5.id,  tackles: 3, interceptions: 2, clearances: 4, passesAttempted: 55, passesCompleted: 50, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 85 }, update: { passesAttempted: 58, passesCompleted: 53 }, create: { matchId: 8, playerId: p6.id,  tackles: 4, interceptions: 3, clearances: 5, passesAttempted: 58, passesCompleted: 53, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 86 }, update: {}, create: { matchId: 8, playerId: p7.id,  tackles: 2, interceptions: 1, passesAttempted: 53, passesCompleted: 47, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 87 }, update: {}, create: { matchId: 8, playerId: p8.id,  tackles: 2, interceptions: 1, passesAttempted: 49, passesCompleted: 43, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 88 }, update: {}, create: { matchId: 8, playerId: p9.id,  tackles: 5, interceptions: 3, passesAttempted: 72, passesCompleted: 65, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 89 }, update: {}, create: { matchId: 8, playerId: p10.id, tackles: 4, interceptions: 2, passesAttempted: 60, passesCompleted: 54, minutesPlayed: 90 } });
  await prisma.playerMatchStats.upsert({ where: { id: 90 }, update: { passesAttempted: 26, passesCompleted: 23 }, create: { matchId: 8, playerId: p13.id, shots: 1, xG: 0.4, shotsOnTarget: 0, passesAttempted: 26, passesCompleted: 23, minutesPlayed: 85 } });
  await prisma.playerMatchStats.upsert({ where: { id: 91 }, update: { passesAttempted: 35, passesCompleted: 32 }, create: { matchId: 8, playerId: p15.id, saves: 2, cleanSheet: true, passesAttempted: 35, passesCompleted: 32, minutesPlayed: 90 } });

  // ── TrainingSession ───────────────────────────────────
  const ts1 = await prisma.trainingSession.upsert({
    where: { id: 1 },
    update: {},
    create: {
      date: new Date("2026-04-07T10:00:00"),
      goal: "압박 수비 조직력 강화",
      sessionType: "TACTICAL_DEFENSIVE",
      isApproved: true,
      seasonId: season.id,
      createdById: coach.id,
      approvedById: admin.id,
      contents: {
        create: [
          { phase: "WARMUP", description: "10분 조깅 + 동적 스트레칭" },
          { phase: "TACTICAL", description: "4-4-2 압박 블록 훈련" },
          { phase: "GAME", description: "11v11 압박 적용 실전 게임" },
        ],
      },
    },
  });

  // Participants
  await prisma.trainingParticipant.createMany({
    data: [
      { sessionId: ts1.id, playerId: p1.id },
      { sessionId: ts1.id, playerId: p2.id },
      { sessionId: ts1.id, playerId: p3.id },
      { sessionId: ts1.id, playerId: p4.id },
      { sessionId: ts1.id, playerId: p5.id },
    ],
    skipDuplicates: true,
  });

  // Results
  await prisma.trainingResult.createMany({
    data: [
      { sessionId: ts1.id, playerId: p1.id, attendance: "PRESENT", performanceScore: 8, feedback: "전방 압박 적극적" },
      { sessionId: ts1.id, playerId: p2.id, attendance: "PRESENT", performanceScore: 9, feedback: "패스 연계 탁월" },
      { sessionId: ts1.id, playerId: p3.id, attendance: "LATE_UNAUTHORIZED", performanceScore: 6 },
      { sessionId: ts1.id, playerId: p4.id, attendance: "PRESENT", performanceScore: 8 },
      { sessionId: ts1.id, playerId: p5.id, attendance: "PRESENT", performanceScore: 7, feedback: "수비 라인 조율 필요" },
    ],
    skipDuplicates: true,
  });

  // ── Injury ────────────────────────────────────────────
  await prisma.injury.upsert({
    where: { id: 1 },
    update: {},
    create: {
      playerId: p3.id,
      bodyPart: "THIGH_BACK",
      cause: "TRAINING",
      status: "REHABILITATING",
      expectedReturnDate: new Date("2026-05-15"),
      medicalStaffId: coach.id,
    },
  });

  // MatchSquad — match2~8 (스코어 있는 나머지 경기, 동일 15명)
  for (const matchId of [match2.id, 3, 4, 5, 6, 7, 8]) {
    await prisma.matchSquad.createMany({
      data: [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15].map((p) => ({
        matchId,
        playerId: p.id,
        isConfirmed: true,
      })),
      skipDuplicates: true,
    });
  }

  // ── TeamMatchStats ────────────────────────────────────
  // match1: FC Seoul 3-1 Busan (홈승)
  await prisma.teamMatchStats.upsert({
    where: { matchId: match1.id },
    update: {},
    create: {
      matchId: match1.id,
      possession: 62, shots: 14, shotsOnTarget: 6,
      passes: 487, passAccuracy: 87,
      fouls: 9, yellowCards: 2, redCards: 0,
      xG: 2.8, corners: 7, offsides: 2, tackles: 18, interceptions: 11, clearances: 8,
    },
  });
  // match2: Incheon 0-2 FC Seoul (원정승)
  await prisma.teamMatchStats.upsert({
    where: { matchId: 2 },
    update: {},
    create: {
      matchId: 2,
      possession: 58, shots: 12, shotsOnTarget: 5,
      passes: 421, passAccuracy: 83,
      fouls: 11, yellowCards: 1, redCards: 0,
      xG: 2.1, corners: 5, offsides: 3, tackles: 22, interceptions: 14, clearances: 12,
    },
  });
  // match3: FC Seoul 1-1 Suwon (홈무)
  await prisma.teamMatchStats.upsert({
    where: { matchId: 3 },
    update: {},
    create: {
      matchId: 3,
      possession: 54, shots: 10, shotsOnTarget: 4,
      passes: 398, passAccuracy: 81,
      fouls: 12, yellowCards: 3, redCards: 0,
      xG: 1.4, corners: 4, offsides: 1, tackles: 16, interceptions: 9, clearances: 15,
    },
  });
  // match4: Jeonbuk 2-0 FC Seoul (원정패)
  await prisma.teamMatchStats.upsert({
    where: { matchId: 4 },
    update: {},
    create: {
      matchId: 4,
      possession: 41, shots: 7, shotsOnTarget: 2,
      passes: 312, passAccuracy: 76,
      fouls: 14, yellowCards: 2, redCards: 0,
      xG: 0.9, corners: 3, offsides: 2, tackles: 25, interceptions: 17, clearances: 22,
    },
  });
  // match5: FC Seoul 2-1 Daegu (홈승)
  await prisma.teamMatchStats.upsert({
    where: { matchId: 5 },
    update: {},
    create: {
      matchId: 5,
      possession: 59, shots: 13, shotsOnTarget: 5,
      passes: 443, passAccuracy: 85,
      fouls: 10, yellowCards: 1, redCards: 0,
      xG: 2.3, corners: 6, offsides: 1, tackles: 19, interceptions: 12, clearances: 9,
    },
  });
  // match6: Ulsan 3-1 FC Seoul (원정패)
  await prisma.teamMatchStats.upsert({
    where: { matchId: 6 },
    update: {},
    create: {
      matchId: 6,
      possession: 38, shots: 8, shotsOnTarget: 3,
      passes: 287, passAccuracy: 74,
      fouls: 15, yellowCards: 3, redCards: 1,
      xG: 1.1, corners: 3, offsides: 4, tackles: 28, interceptions: 19, clearances: 26,
    },
  });
  // match7: FC Seoul 0-0 Pohang (홈무)
  await prisma.teamMatchStats.upsert({
    where: { matchId: 7 },
    update: {},
    create: {
      matchId: 7,
      possession: 52, shots: 9, shotsOnTarget: 2,
      passes: 411, passAccuracy: 82,
      fouls: 11, yellowCards: 2, redCards: 0,
      xG: 0.7, corners: 5, offsides: 2, tackles: 20, interceptions: 13, clearances: 14,
    },
  });
  // match8: FC Seoul 3-0 Gangwon FA컵 (홈승)
  await prisma.teamMatchStats.upsert({
    where: { matchId: 8 },
    update: {},
    create: {
      matchId: 8,
      possession: 67, shots: 16, shotsOnTarget: 8,
      passes: 521, passAccuracy: 89,
      fouls: 7, yellowCards: 1, redCards: 0,
      xG: 3.2, corners: 9, offsides: 1, tackles: 14, interceptions: 8, clearances: 5,
    },
  });

  // ── TacticalAnalysis ──────────────────────────────────
  await prisma.tacticalAnalysis.upsert({
    where: { id: 1 },
    update: {},
    create: {
      matchId: match1.id,
      seasonId: season.id,
      phase: "PRE_MATCH",
      formation: "4-2-3-1",
      opponentAnalysis: "부산은 측면 공격 위주. 윙백 압박 집중 필요.",
      createdById: coach.id,
      lineup: {
        create: [
          { playerId: p4.id, position: "GOALKEEPER" },
          { playerId: p5.id, position: "CENTER_BACK" },
          { playerId: p2.id, position: "CENTRAL_ATTACK_MIDFIELDER" },
          { playerId: p1.id, position: "STRIKER" },
          { playerId: p3.id, position: "WINGER" },
        ],
      },
    },
  });

  await prisma.tacticalAnalysis.upsert({
    where: { id: 2 },
    update: {},
    create: {
      matchId: match1.id,
      seasonId: season.id,
      phase: "POST_MATCH",
      formation: "4-2-3-1",
      opponentAnalysis: "2선 압박 성공. 측면 전환 속도 개선 필요.",
      createdById: coach.id,
      status: "CONFIRMED",
    },
  });

  await prisma.tacticalAnalysis.upsert({
    where: { id: 3 },
    update: {},
    create: {
      matchId: match2.id,
      seasonId: season.id,
      phase: "PRE_MATCH",
      formation: "4-3-3",
      opponentAnalysis: "인천은 빌드업 회피, 롱볼 의존. 세컨볼 경합 중요.",
      createdById: coach.id,
    },
  });

  // ── Jersey Numbers ───────────────────────────────────
  await prisma.jerseyNumber.createMany({
    data: [
      { number: 9,  teamId: firstTeam.id, playerId: p1.id, status: "OCCUPIED" },
      { number: 10, teamId: firstTeam.id, playerId: p2.id, status: "OCCUPIED" },
      { number: 11, teamId: firstTeam.id, playerId: p3.id, status: "OCCUPIED" },
      { number: 1,  teamId: firstTeam.id, playerId: p4.id, status: "OCCUPIED" },
      { number: 5,  teamId: firstTeam.id, playerId: p5.id, status: "OCCUPIED" },
      { number: 4,  teamId: firstTeam.id, playerId: p6.id, status: "OCCUPIED" },
      { number: 3,  teamId: firstTeam.id, playerId: p7.id, status: "OCCUPIED" },
      { number: 7,  teamId: firstTeam.id, status: "RESERVED" },
    ],
    skipDuplicates: true,
  });

  // ── YOUTH Teams ──────────────────────────────────────
  const u15Team = await prisma.team.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: 'U-15',
      type: 'YOUTH',
      ageGroup: 'U15',
      isActive: true,
      trackStats: false,
      requiresContract: false,
    },
  });

  const u18Team = await prisma.team.upsert({
    where: { id: 3 },
    update: {},
    create: {
      name: 'U-18',
      type: 'YOUTH',
      ageGroup: 'U18',
      isActive: true,
      trackStats: false,
      requiresContract: false,
    },
  });

  // ── YOUTH Coaching Staff ──────────────────────────────
  const yc1Phone = await prisma.phoneNumber.create({ data: encryptPhone("010-0001-0001") });
  const yc2Phone = await prisma.phoneNumber.create({ data: encryptPhone("010-0001-0002") });

  const youthCoach1 = await prisma.user.upsert({
    where: { email: "youth.coach1@club.com" },
    update: {},
    create: {
      email: "youth.coach1@club.com",
      password: hashed,
      username: "유소년감독",
      nickname: "youthhead",
      role: "COACHING_STAFF",
      coachingRole: "HEAD_COACH",
      dateOfBirth: new Date("1982-04-10"),
      nationalityId: korea.id,
      phoneNumberId: yc1Phone.id,
    },
  });

  const youthCoach2 = await prisma.user.upsert({
    where: { email: "youth.coach2@club.com" },
    update: {},
    create: {
      email: "youth.coach2@club.com",
      password: hashed,
      username: "유소년코치",
      nickname: "youthcoach",
      role: "COACHING_STAFF",
      coachingRole: "ASSISTANT_COACH",
      dateOfBirth: new Date("1985-08-22"),
      nationalityId: korea.id,
      phoneNumberId: yc2Phone.id,
    },
  });

  // ── GUARDIAN Users ────────────────────────────────────
  const guardianPhones = await Promise.all([
    prisma.phoneNumber.create({ data: encryptPhone("010-0002-0001") }),
    prisma.phoneNumber.create({ data: encryptPhone("010-0002-0002") }),
    prisma.phoneNumber.create({ data: encryptPhone("010-0002-0003") }),
    prisma.phoneNumber.create({ data: encryptPhone("010-0002-0004") }),
    prisma.phoneNumber.create({ data: encryptPhone("010-0002-0005") }),
    prisma.phoneNumber.create({ data: encryptPhone("010-0002-0006") }),
    prisma.phoneNumber.create({ data: encryptPhone("010-0002-0007") }),
    prisma.phoneNumber.create({ data: encryptPhone("010-0002-0008") }),
  ]);

  const guardianData = [
    { email: "guardian1@club.com", username: "김부모", nickname: "guardian1", dob: "1975-03-15" },
    { email: "guardian2@club.com", username: "이부모", nickname: "guardian2", dob: "1977-07-20" },
    { email: "guardian3@club.com", username: "박부모", nickname: "guardian3", dob: "1976-11-05" },
    { email: "guardian4@club.com", username: "최부모", nickname: "guardian4", dob: "1978-02-28" },
    { email: "guardian5@club.com", username: "정부모", nickname: "guardian5", dob: "1974-09-12" },
    { email: "guardian6@club.com", username: "한부모", nickname: "guardian6", dob: "1979-06-03" },
    { email: "guardian7@club.com", username: "오부모", nickname: "guardian7", dob: "1973-12-18" },
    { email: "guardian8@club.com", username: "윤부모", nickname: "guardian8", dob: "1980-04-25" },
  ];

  const guardians = await Promise.all(
    guardianData.map((g, i) =>
      prisma.user.upsert({
        where: { email: g.email },
        update: {},
        create: {
          email: g.email,
          password: hashed,
          username: g.username,
          nickname: g.nickname,
          role: "GUARDIAN",
          dateOfBirth: new Date(g.dob),
          nationalityId: korea.id,
          phoneNumberId: guardianPhones[i]!.id,
        },
      }),
    ),
  );

  // ── YOUTH Players (U-15) ──────────────────────────────
  const yp1 = await prisma.player.upsert({
    where: { id: "youth-u15-001" },
    update: {},
    create: {
      id: "youth-u15-001",
      playerName: "김유스",
      dateOfBirth: new Date("2011-03-12"),
      preferredFoot: "RIGHT",
      height: 165,
      weight: 55,
      position: "GOALKEEPER",
      level: "YOUTH",
      status: "ACTIVE",
      nationalityId: korea.id,
      teamId: u15Team.id,
      guardianId: guardians[0]!.id,
    },
  });

  const yp2 = await prisma.player.upsert({
    where: { id: "youth-u15-002" },
    update: {},
    create: {
      id: "youth-u15-002",
      playerName: "이소년",
      dateOfBirth: new Date("2011-07-22"),
      preferredFoot: "RIGHT",
      height: 168,
      weight: 57,
      position: "CENTER_BACK",
      level: "YOUTH",
      status: "ACTIVE",
      nationalityId: korea.id,
      teamId: u15Team.id,
      guardianId: guardians[1]!.id,
    },
  });

  const yp3 = await prisma.player.upsert({
    where: { id: "youth-u15-003" },
    update: {},
    create: {
      id: "youth-u15-003",
      playerName: "박청소년",
      dateOfBirth: new Date("2012-01-05"),
      preferredFoot: "LEFT",
      height: 162,
      weight: 53,
      position: "CENTER_BACK",
      level: "YOUTH",
      status: "ACTIVE",
      nationalityId: korea.id,
      teamId: u15Team.id,
      guardianId: guardians[2]!.id,
    },
  });

  const yp4 = await prisma.player.upsert({
    where: { id: "youth-u15-004" },
    update: {},
    create: {
      id: "youth-u15-004",
      playerName: "최미드",
      dateOfBirth: new Date("2011-09-18"),
      preferredFoot: "RIGHT",
      height: 164,
      weight: 56,
      position: "CENTRAL_ATTACK_MIDFIELDER",
      level: "YOUTH",
      status: "ACTIVE",
      nationalityId: korea.id,
      teamId: u15Team.id,
      guardianId: guardians[3]!.id,
    },
  });

  const yp5 = await prisma.player.upsert({
    where: { id: "youth-u15-005" },
    update: {},
    create: {
      id: "youth-u15-005",
      playerName: "정공격수",
      dateOfBirth: new Date("2012-05-30"),
      preferredFoot: "RIGHT",
      height: 167,
      weight: 58,
      position: "STRIKER",
      level: "YOUTH",
      status: "ACTIVE",
      nationalityId: korea.id,
      teamId: u15Team.id,
      guardianId: guardians[4]!.id,
    },
  });

  // ── YOUTH Players (U-18) ──────────────────────────────
  const yp6 = await prisma.player.upsert({
    where: { id: "youth-u18-001" },
    update: {},
    create: {
      id: "youth-u18-001",
      playerName: "한골키퍼",
      dateOfBirth: new Date("2008-04-14"),
      preferredFoot: "RIGHT",
      height: 182,
      weight: 72,
      position: "GOALKEEPER",
      level: "YOUTH",
      status: "ACTIVE",
      nationalityId: korea.id,
      teamId: u18Team.id,
      guardianId: guardians[5]!.id,
    },
  });

  const yp7 = await prisma.player.upsert({
    where: { id: "youth-u18-002" },
    update: {},
    create: {
      id: "youth-u18-002",
      playerName: "오수비수",
      dateOfBirth: new Date("2008-11-02"),
      preferredFoot: "RIGHT",
      height: 178,
      weight: 68,
      position: "LEFT_FULL_BACK",
      level: "YOUTH",
      status: "ACTIVE",
      nationalityId: korea.id,
      teamId: u18Team.id,
      guardianId: guardians[6]!.id,
    },
  });

  const yp8 = await prisma.player.upsert({
    where: { id: "youth-u18-003" },
    update: {},
    create: {
      id: "youth-u18-003",
      playerName: "윤센터백",
      dateOfBirth: new Date("2009-02-19"),
      preferredFoot: "RIGHT",
      height: 180,
      weight: 70,
      position: "CENTER_BACK",
      level: "YOUTH",
      status: "ACTIVE",
      nationalityId: korea.id,
      teamId: u18Team.id,
      guardianId: guardians[7]!.id,
    },
  });

  const yp9 = await prisma.player.upsert({
    where: { id: "youth-u18-004" },
    update: {},
    create: {
      id: "youth-u18-004",
      playerName: "강미드필더",
      dateOfBirth: new Date("2008-08-07"),
      preferredFoot: "BOTH",
      height: 174,
      weight: 65,
      position: "CENTRAL_DEFENSIVE_MIDFIELDER",
      level: "YOUTH",
      status: "ACTIVE",
      nationalityId: korea.id,
      teamId: u18Team.id,
      guardianId: guardians[5]!.id,
    },
  });

  const yp10 = await prisma.player.upsert({
    where: { id: "youth-u18-005" },
    update: {},
    create: {
      id: "youth-u18-005",
      playerName: "임스트라이커",
      dateOfBirth: new Date("2009-06-25"),
      preferredFoot: "LEFT",
      height: 176,
      weight: 67,
      position: "STRIKER",
      level: "YOUTH",
      status: "ACTIVE",
      nationalityId: korea.id,
      teamId: u18Team.id,
      guardianId: guardians[6]!.id,
    },
  });

  // ── YouthRegistrations ────────────────────────────────
  const adminUser = await prisma.user.findUnique({ where: { email: "admin@club.com" }, select: { id: true } });

  await prisma.youthRegistration.createMany({
    data: [
      {
        playerName: yp1.playerName,
        birthDate: yp1.dateOfBirth,
        preferredJerseyNumber: 1,
        teamId: u15Team.id,
        guardianId: guardians[0]!.id,
        status: "CONTRACTED",
        requestedById: adminUser!.id,
      },
      {
        playerName: yp2.playerName,
        birthDate: yp2.dateOfBirth,
        preferredJerseyNumber: 4,
        teamId: u15Team.id,
        guardianId: guardians[1]!.id,
        status: "CONTRACTED",
        requestedById: adminUser!.id,
      },
      {
        playerName: yp3.playerName,
        birthDate: yp3.dateOfBirth,
        teamId: u15Team.id,
        guardianId: guardians[2]!.id,
        status: "GUARDIAN_APPROVED",
        requestedById: adminUser!.id,
      },
      {
        playerName: yp4.playerName,
        birthDate: yp4.dateOfBirth,
        preferredJerseyNumber: 10,
        teamId: u15Team.id,
        guardianId: guardians[3]!.id,
        status: "PENDING",
        requestedById: adminUser!.id,
      },
      {
        playerName: yp6.playerName,
        birthDate: yp6.dateOfBirth,
        preferredJerseyNumber: 1,
        teamId: u18Team.id,
        guardianId: guardians[5]!.id,
        status: "CONTRACTED",
        requestedById: adminUser!.id,
      },
      {
        playerName: yp8.playerName,
        birthDate: yp8.dateOfBirth,
        teamId: u18Team.id,
        guardianId: guardians[7]!.id,
        status: "PENDING",
        requestedById: adminUser!.id,
      },
    ],
    skipDuplicates: false,
  });

  // Mock distanceCovered + sprint for all players who played (distanceCovered/sprint 미입력 레코드만)
  const playedStats = await prisma.playerMatchStats.findMany({
    where: { minutesPlayed: { gt: 0 }, distanceCovered: null },
    select: { id: true, minutesPlayed: true, saves: true },
  });
  for (const s of playedStats) {
    const mins = s.minutesPlayed ?? 0;
    const ratio = mins / 90;
    const isGK = (s.saves ?? 0) > 0;
    // GK: 5.5~6.5 km / 10~18 스프린트, 필드: 9.5~11.5 km / 35~55 스프린트
    const baseKm     = isGK ? 5.5  : 9.5;
    const rangeKm    = isGK ? 1.0  : 2.0;
    const baseSprint = isGK ? 10   : 35;
    const rangeSprint = isGK ? 8   : 20;
    const distanceCovered = Math.round((baseKm + Math.random() * rangeKm) * ratio * 10) / 10;
    const sprint          = Math.round((baseSprint + Math.random() * rangeSprint) * ratio);
    await prisma.playerMatchStats.update({ where: { id: s.id }, data: { distanceCovered, sprint } });
  }
  if (playedStats.length) console.log(`   - Activity mock: ${playedStats.length}개 레코드 패치 완료`);

  console.log("✅ Seed complete");
  console.log(`   - Countries: 2`);
  console.log(`   - Users: 14 + 10 유소년 / pw: Password1!`);
  console.log(`     ADMIN       : admin@club.com`);
  console.log(`     FRONT_OFFICE: gm@club.com (GM)`);
  console.log(`     FRONT_OFFICE: td@club.com (TD)`);
  console.log(`     FRONT_OFFICE: fo@club.com (SCOUT)`);
  console.log(`     PLAYER      : player@club.com`);
  console.log(`     HEAD_COACH  : coach@club.com`);
  console.log(`     YOUTH COACH : youth.coach1@club.com (감독)`);
  console.log(`     YOUTH COACH : youth.coach2@club.com (코치)`);
  console.log(`     GUARDIAN    : guardian1~8@club.com`);
  console.log(`   - Season: ${season.name}`);
  console.log(`   - Players: 20 (1군) + 10 (유소년: U15×5, U18×5)`);
  console.log(`   - Youth Teams: U-15 (id:${u15Team.id}), U-18 (id:${u18Team.id})`);
  console.log(`   - YouthRegistrations: 6 (CONTRACTED×3, GUARDIAN_APPROVED×1, PENDING×2)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
