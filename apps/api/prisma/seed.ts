import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/client";
import bcrypt from "bcrypt";
import crypto from "crypto";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

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

  // PlayerMatchStats — match1
  await prisma.playerMatchStats.upsert({
    where: { id: 1 },
    update: {},
    create: {
      matchId: match1.id,
      playerId: p1.id,
      goals: 2,
      assists: 1,
      xG: 2.3,
      shots: 5,
      minutesPlayed: 90,
    },
  });

  await prisma.playerMatchStats.upsert({
    where: { id: 2 },
    update: {},
    create: {
      matchId: match1.id,
      playerId: p2.id,
      goals: 1,
      assists: 2,
      keyPasses: 4,
      passAccuracy: 88.5,
      minutesPlayed: 90,
    },
  });

  // match2: Incheon 0-2 FC Seoul (원정승) — p1 2골
  await prisma.playerMatchStats.upsert({
    where: { id: 3 },
    update: {},
    create: { matchId: 2, playerId: p1.id, goals: 2, assists: 0, xG: 1.9, shots: 4, minutesPlayed: 90 },
  });
  await prisma.playerMatchStats.upsert({
    where: { id: 4 },
    update: {},
    create: { matchId: 2, playerId: p3.id, goals: 0, assists: 2, xG: 0.4, shots: 2, minutesPlayed: 90 },
  });

  // match3: FC Seoul 1-1 Suwon — p2 1골
  await prisma.playerMatchStats.upsert({
    where: { id: 5 },
    update: {},
    create: { matchId: 3, playerId: p2.id, goals: 1, assists: 0, xG: 1.1, shots: 3, minutesPlayed: 90 },
  });
  await prisma.playerMatchStats.upsert({
    where: { id: 6 },
    update: {},
    create: { matchId: 3, playerId: p1.id, goals: 0, assists: 1, xG: 0.6, shots: 3, minutesPlayed: 82 },
  });

  // match4: Jeonbuk 2-0 FC Seoul (원정패) — 무득점
  await prisma.playerMatchStats.upsert({
    where: { id: 7 },
    update: {},
    create: { matchId: 4, playerId: p1.id, goals: 0, assists: 0, xG: 0.5, shots: 2, minutesPlayed: 90 },
  });
  await prisma.playerMatchStats.upsert({
    where: { id: 8 },
    update: {},
    create: { matchId: 4, playerId: p5.id, goals: 0, assists: 0, xG: 0.2, shots: 1, minutesPlayed: 90 },
  });

  // match5: FC Seoul 2-1 Daegu — p1 1골, p3 1골
  await prisma.playerMatchStats.upsert({
    where: { id: 9 },
    update: {},
    create: { matchId: 5, playerId: p1.id, goals: 1, assists: 0, xG: 1.4, shots: 4, minutesPlayed: 90 },
  });
  await prisma.playerMatchStats.upsert({
    where: { id: 10 },
    update: {},
    create: { matchId: 5, playerId: p3.id, goals: 1, assists: 0, xG: 0.9, shots: 3, minutesPlayed: 90 },
  });
  await prisma.playerMatchStats.upsert({
    where: { id: 11 },
    update: {},
    create: { matchId: 5, playerId: p2.id, goals: 0, assists: 2, xG: 0.3, keyPasses: 5, minutesPlayed: 90 },
  });

  // match6: Ulsan 3-1 FC Seoul (원정패) — p2 1골
  await prisma.playerMatchStats.upsert({
    where: { id: 12 },
    update: {},
    create: { matchId: 6, playerId: p2.id, goals: 1, assists: 0, xG: 0.8, shots: 2, minutesPlayed: 90 },
  });
  await prisma.playerMatchStats.upsert({
    where: { id: 13 },
    update: {},
    create: { matchId: 6, playerId: p1.id, goals: 0, assists: 1, xG: 0.7, shots: 3, minutesPlayed: 90 },
  });

  // match7: FC Seoul 0-0 Pohang — 무득점
  await prisma.playerMatchStats.upsert({
    where: { id: 14 },
    update: {},
    create: { matchId: 7, playerId: p1.id, goals: 0, assists: 0, xG: 0.4, shots: 2, minutesPlayed: 90 },
  });

  // match8: FC Seoul 3-0 Gangwon FA컵 — p1 2골, p2 1골
  await prisma.playerMatchStats.upsert({
    where: { id: 15 },
    update: {},
    create: { matchId: 8, playerId: p1.id, goals: 2, assists: 0, xG: 2.1, shots: 5, minutesPlayed: 90 },
  });
  await prisma.playerMatchStats.upsert({
    where: { id: 16 },
    update: {},
    create: { matchId: 8, playerId: p2.id, goals: 1, assists: 1, xG: 1.0, shots: 3, minutesPlayed: 90 },
  });
  await prisma.playerMatchStats.upsert({
    where: { id: 17 },
    update: {},
    create: { matchId: 8, playerId: p3.id, goals: 0, assists: 2, xG: 0.5, shots: 2, minutesPlayed: 90 },
  });

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

  // FA컵
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

  // 예정 경기 (스코어 없음)
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

  console.log("✅ Seed complete");
  console.log(`   - Countries: 2`);
  console.log(`   - Users: 14 / pw: Password1!`);
  console.log(`     ADMIN       : admin@club.com`);
  console.log(`     FRONT_OFFICE: gm@club.com (GM)`);
  console.log(`     FRONT_OFFICE: td@club.com (TD)`);
  console.log(`     FRONT_OFFICE: fo@club.com (SCOUT)`);
  console.log(`     PLAYER      : player@club.com`);
  console.log(`     HEAD_COACH  : coach@club.com`);
  console.log(`     ASSISTANT   : assistant@club.com`);
  console.log(`     DEFENSIVE   : defensive@club.com`);
  console.log(`     ATTACKING   : attacking@club.com`);
  console.log(`     PHYSICAL    : physical@club.com`);
  console.log(`     SET_PIECE   : setpiece@club.com`);
  console.log(`     GOALKEEPER  : gk@club.com`);
  console.log(`     MEDICAL     : medical@club.com`);
  console.log(`     MED_DIR     : meddir@club.com`);
  console.log(`   - Season: ${season.name}`);
  console.log(`   - Players: 20`);
  console.log(`   - Contracts: 3`);
  console.log(`   - Matches: 12 (7 완료 + 1 컵 + 4 예정)`);
  console.log(`   - Training session: 1`);
  console.log(`   - Injury: 1`);
  console.log(`   - Tactical analysis: 1`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
