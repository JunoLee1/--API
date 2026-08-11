import { describe, test, jest, expect, beforeEach } from "@jest/globals";

process.env["PHONE_ENCRYPTION_KEY"] = "a".repeat(64);

import { encrypt, decrypt } from "../../src/lib/crypto";

const mockPrisma = {
  player: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock("../../src/lib/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

import { PlayerRepository } from "../../src/player/player.repo";

describe("PlayerRepository — encryption on write", () => {
  let repo: PlayerRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PlayerRepository(mockPrisma as any);
  });

  test("create() encrypts emergencyContactName before saving", async () => {
    (mockPrisma.player.create as jest.Mock).mockResolvedValue({ id: "p1", playerName: "Test" });

    await repo.create({
      playerName: "Test",
      dateOfBirth: "2000-01-01",
      preferredFoot: "RIGHT",
      height: 180,
      weight: 75,
      position: "STRIKER",
      level: "SENIOR",
      nationalityId: 1,
      emergencyContactName: "Jane Doe",
    } as any);

    const savedData = (mockPrisma.player.create as jest.Mock).mock.calls[0][0].data;
    expect(savedData.emergencyContactName).toBeUndefined();
    expect(savedData.emergencyContactNameEncrypted).toBeDefined();
    expect(savedData.emergencyContactNameIv).toBeDefined();
    const decrypted = decrypt(savedData.emergencyContactNameEncrypted, savedData.emergencyContactNameIv);
    expect(decrypted).toBe("Jane Doe");
  });

  test("create() encrypts dateOfBirth before saving", async () => {
    (mockPrisma.player.create as jest.Mock).mockResolvedValue({ id: "p1", playerName: "Test" });

    await repo.create({
      playerName: "Test",
      dateOfBirth: "2000-06-15",
      preferredFoot: "LEFT",
      height: 175,
      weight: 70,
      position: "GOALKEEPER",
      level: "ROOKIE",
      nationalityId: 1,
    } as any);

    const savedData = (mockPrisma.player.create as jest.Mock).mock.calls[0][0].data;
    expect(savedData.dateOfBirthEncrypted).toBeDefined();
    expect(savedData.dateOfBirthIv).toBeDefined();
    expect(savedData.dateOfBirth).toBeUndefined();
    const decrypted = decrypt(savedData.dateOfBirthEncrypted, savedData.dateOfBirthIv);
    expect(decrypted).toBe("2000-06-15");
  });

  test("update() encrypts only provided emergency contact fields", async () => {
    (mockPrisma.player.update as jest.Mock).mockResolvedValue({ id: "p1" });

    await repo.update("p1", {
      emergencyContactPhone: "010-1234-5678",
    } as any);

    const savedData = (mockPrisma.player.update as jest.Mock).mock.calls[0][0].data;
    expect(savedData.emergencyContactPhone).toBeUndefined();
    expect(savedData.emergencyContactPhoneEncrypted).toBeDefined();
    expect(savedData.emergencyContactPhoneIv).toBeDefined();
    expect(savedData.emergencyContactNameEncrypted).toBeUndefined();
  });
});

describe("PlayerRepository — encrypted field selection on read", () => {
  let repo: PlayerRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PlayerRepository(mockPrisma as any);
  });

  test("findById(id, true) selects encrypted emergency contact fields", async () => {
    (mockPrisma.player.findUnique as jest.Mock).mockResolvedValue(null);
    await repo.findById("p1", true);

    const selectArg = (mockPrisma.player.findUnique as jest.Mock).mock.calls[0][0].select;
    expect(selectArg.emergencyContactNameEncrypted).toBe(true);
    expect(selectArg.emergencyContactNameIv).toBe(true);
    expect(selectArg.emergencyContactName).toBeUndefined();
  });

  test("findById(id, false) does NOT select emergency contact fields", async () => {
    (mockPrisma.player.findUnique as jest.Mock).mockResolvedValue(null);
    await repo.findById("p1", false);

    const selectArg = (mockPrisma.player.findUnique as jest.Mock).mock.calls[0][0].select;
    expect(selectArg.emergencyContactNameEncrypted).toBeUndefined();
  });

  test("PLAYER_SELECT does not include dateOfBirth plaintext", async () => {
    (mockPrisma.player.findMany as jest.Mock).mockResolvedValue([]);
    await repo.findAll({});

    const selectArg = (mockPrisma.player.findMany as jest.Mock).mock.calls[0][0].select;
    expect(selectArg.dateOfBirth).toBeUndefined();
  });
});

// Must be after all the repo tests — import PlayerService here
import { PlayerService } from "../../src/player/player.service";

describe("PlayerService — decrypt on read", () => {
  test("getPlayerById decrypts emergencyContactName and dateOfBirth", async () => {
    const nameEnc = encrypt("Jane Doe");
    const dobEnc = encrypt("2000-01-01");

    const mockRepo = {
      findById: jest.fn().mockResolvedValue({
        id: "p1",
        playerName: "Test Player",
        dateOfBirthEncrypted: dobEnc.encrypted,
        dateOfBirthIv: dobEnc.iv,
        emergencyContactNameEncrypted: nameEnc.encrypted,
        emergencyContactNameIv: nameEnc.iv,
        emergencyContactPhoneEncrypted: null,
        emergencyContactPhoneIv: null,
        emergencyContactRelationEncrypted: null,
        emergencyContactRelationIv: null,
      }),
    };

    const service = new PlayerService(mockRepo as any);
    const result = await service.getPlayerById("p1", true);

    expect(result.emergencyContactName).toBe("Jane Doe");
    expect((result as any).emergencyContactNameEncrypted).toBeUndefined();
    expect((result as any).emergencyContactNameIv).toBeUndefined();
    expect((result as any).dateOfBirth).toBe("2000-01-01");
    expect((result as any).dateOfBirthEncrypted).toBeUndefined();
  });

  test("getPlayerById with includePrivate=false returns dateOfBirth but no emergency contacts", async () => {
    const dobEnc = encrypt("1998-03-10");

    const mockRepo = {
      findById: jest.fn().mockResolvedValue({
        id: "p1",
        playerName: "Test Player",
        dateOfBirthEncrypted: dobEnc.encrypted,
        dateOfBirthIv: dobEnc.iv,
      }),
    };

    const service = new PlayerService(mockRepo as any);
    const result = await service.getPlayerById("p1", false);

    expect((result as any).dateOfBirth).toBe("1998-03-10");
    expect((result as any).emergencyContactName).toBeUndefined();
  });
});
