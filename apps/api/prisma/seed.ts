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
  const adminPhone = await prisma.phoneNumber.create({ data: encryptPhone("010-0000-0001") });
  const coachPhone = await prisma.phoneNumber.create({ data: encryptPhone("010-0000-0002") });
  const foPhone = await prisma.phoneNumber.create({ data: encryptPhone("010-0000-0003") });

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

  const frontOffice = await prisma.user.upsert({
    where: { email: "fo@club.com" },
    update: {},
    create: {
      email: "fo@club.com",
      password: hashed,
      username: "프런트",
      nickname: "frontoffice",
      role: "FRONT_OFFICE",
      dateOfBirth: new Date("1985-03-20"),
      nationalityId: korea.id,
      phoneNumberId: foPhone.id,
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
      bodyPart: "우측 햄스트링",
      cause: "TRAINING",
      status: "REHABILITATING",
      expectedReturnDate: new Date("2026-05-15"),
      medicalStaffId: coach.id,
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

  console.log("✅ Seed complete");
  console.log(`   - Countries: 2`);
  console.log(`   - Users: 3 (admin@club.com, coach@club.com, fo@club.com) / pw: Password1!`);
  console.log(`   - Season: ${season.name}`);
  console.log(`   - Players: 5`);
  console.log(`   - Contracts: 3`);
  console.log(`   - Matches: 2`);
  console.log(`   - Training session: 1`);
  console.log(`   - Injury: 1`);
  console.log(`   - Tactical analysis: 1`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
