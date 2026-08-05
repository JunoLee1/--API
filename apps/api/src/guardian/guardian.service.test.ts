import { GuardianService } from "./guardian.service";
import type { GuardianRepository } from "./guardian.repo";

const makeRepo = (overrides: Partial<GuardianRepository> = {}): GuardianRepository =>
  ({
    findPlayerBySearch: jest.fn().mockResolvedValue(null),
    findInviteCode: jest.fn().mockResolvedValue(null),
    findActiveInviteCode: jest.fn().mockResolvedValue(null),
    createInviteCode: jest.fn(),
    linkGuardianToPlayer: jest.fn().mockResolvedValue({}),
    markCodeUsed: jest.fn().mockResolvedValue({}),
    findChildByGuardian: jest.fn().mockResolvedValue(null),
    findDashboard: jest.fn().mockResolvedValue([null, [], [], [], null, null, [], null, []]),
    ...overrides,
  } as unknown as GuardianRepository);

const fakePlayer = { id: "player-1", guardianId: null, playerName: "김유소" };

describe("GuardianService.linkBySearch", () => {
  it("존재하지 않는 자녀 → 404", async () => {
    const svc = new GuardianService(makeRepo());
    await expect(
      svc.linkBySearch({ studentCode: "SC001", playerName: "김유소", dateOfBirth: "2015-01-01" }, 1)
    ).rejects.toMatchObject({ statusCode: 404, message: "PLAYER_NOT_FOUND" });
  });

  it("이미 다른 guardian에 연동된 자녀 → 409", async () => {
    const svc = new GuardianService(
      makeRepo({ findPlayerBySearch: jest.fn().mockResolvedValue({ ...fakePlayer, guardianId: 99 }) })
    );
    await expect(
      svc.linkBySearch({ studentCode: "SC001", playerName: "김유소", dateOfBirth: "2015-01-01" }, 1)
    ).rejects.toMatchObject({ statusCode: 409, message: "ALREADY_LINKED" });
  });

  it("성공 → linkGuardianToPlayer 호출", async () => {
    const repo = makeRepo({ findPlayerBySearch: jest.fn().mockResolvedValue(fakePlayer) });
    const svc = new GuardianService(repo);
    await svc.linkBySearch({ studentCode: "SC001", playerName: "김유소", dateOfBirth: "2015-01-01" }, 1);
    expect(repo.linkGuardianToPlayer).toHaveBeenCalledWith("player-1", 1);
  });
});

describe("GuardianService.linkByCode", () => {
  it("존재하지 않는 코드 → 404", async () => {
    const svc = new GuardianService(makeRepo());
    await expect(svc.linkByCode({ code: "ABCD1234" }, 1)).rejects.toMatchObject({ statusCode: 404, message: "INVALID_CODE" });
  });

  it("이미 사용된 코드 → 409", async () => {
    const repo = makeRepo({
      findInviteCode: jest.fn().mockResolvedValue({
        id: 1, playerId: "player-1", usedAt: new Date(), expiresAt: new Date(Date.now() + 1000),
      }),
    });
    const svc = new GuardianService(repo);
    await expect(svc.linkByCode({ code: "ABCD1234" }, 1)).rejects.toMatchObject({ statusCode: 409, message: "CODE_ALREADY_USED" });
  });

  it("만료된 코드 → 410", async () => {
    const repo = makeRepo({
      findInviteCode: jest.fn().mockResolvedValue({
        id: 1, playerId: "player-1", usedAt: null, expiresAt: new Date(Date.now() - 1000),
      }),
    });
    const svc = new GuardianService(repo);
    await expect(svc.linkByCode({ code: "ABCD1234" }, 1)).rejects.toMatchObject({ statusCode: 410, message: "CODE_EXPIRED" });
  });

  it("성공 → linkGuardianToPlayer + markCodeUsed 호출", async () => {
    const repo = makeRepo({
      findInviteCode: jest.fn().mockResolvedValue({
        id: 1, playerId: "player-1", usedAt: null, expiresAt: new Date(Date.now() + 100000),
      }),
    });
    const svc = new GuardianService(repo);
    await svc.linkByCode({ code: "ABCD1234" }, 1);
    expect(repo.linkGuardianToPlayer).toHaveBeenCalledWith("player-1", 1);
    expect(repo.markCodeUsed).toHaveBeenCalledWith(1, 1);
  });
});

describe("GuardianService.issueInviteCode", () => {
  it("미사용·미만료 코드가 있으면 기존 코드 반환", async () => {
    const existing = { id: 1, code: "EXIST123", playerId: "player-1", usedAt: null, expiresAt: new Date(Date.now() + 1000), issuedById: 2 };
    const repo = makeRepo({ findActiveInviteCode: jest.fn().mockResolvedValue(existing) });
    const svc = new GuardianService(repo);
    const result = await svc.issueInviteCode({ playerId: "player-1" }, 2);
    expect(result).toBe(existing);
    expect(repo.createInviteCode).not.toHaveBeenCalled();
  });

  it("없으면 새 코드 생성", async () => {
    const repo = makeRepo({ createInviteCode: jest.fn().mockResolvedValue({ code: "NEW12345" }) });
    const svc = new GuardianService(repo);
    await svc.issueInviteCode({ playerId: "player-1" }, 2);
    expect(repo.createInviteCode).toHaveBeenCalled();
  });
});
