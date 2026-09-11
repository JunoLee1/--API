import { ContractService } from "../../src/contract/contract.service";

jest.mock("../../src/lib/auditLog", () => ({ writeAuditLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../../src/lib/prisma", () => ({
  getPrisma: jest.fn().mockReturnValue({
    player: { findUnique: jest.fn().mockResolvedValue({ status: "ACTIVE" }) },
  }),
}));

const makeRepo = (overrides: Record<string, unknown> = {}) => ({
  findById: jest.fn(),
  hasBuyout: jest.fn(),
  create: jest.fn(),
  createBuyout: jest.fn(),
  createExtension: jest.fn(),
  createBonus: jest.fn(),
  updateStatus: jest.fn(),
  findByPlayerId: jest.fn(),
  findActiveBuyout: jest.fn(),
  getSquadSalaryByPosition: jest.fn(),
  getContractExpirySoonWithMarketValue: jest.fn(),
  getTransferPnL: jest.fn(),
  getSalaryBenchmarkByLevel: jest.fn(),
  getProspectCostSummary: jest.fn(),
  terminateActiveContracts: jest.fn(),
  ...overrides,
});

const makeWageCap = () => ({ check: jest.fn().mockResolvedValue({ status: "OK" }) });

const makeNotifRepo = () => ({
  createForGM: jest.fn().mockResolvedValue(undefined),
  createForTD: jest.fn().mockResolvedValue(undefined),
});

const makeService = (repoOverrides = {}, notifOverrides = {}) =>
  new ContractService(
    makeRepo(repoOverrides) as any,
    makeWageCap() as any,
    { ...makeNotifRepo(), ...notifOverrides } as any,
  );

const BASE_DTO = {
  playerId: "player-1",
  salary: 50_000_000,
  startDate: "2025-01-01",
  endDate: "2026-12-31",
};

// ─── #522: createContract → GM 알림 ─────────────────────────────────────────

describe("#522 ContractService.createContract — GM 알림", () => {
  it("계약 생성 시 GM에게 알림을 보낸다", async () => {
    const created = { id: 10, ...BASE_DTO };
    const createForGM = jest.fn().mockResolvedValue(undefined);
    const svc = makeService(
      { create: jest.fn().mockResolvedValue(created) },
      { createForGM },
    );
    await svc.createContract(BASE_DTO, 1);
    expect(createForGM).toHaveBeenCalledWith(
      "CONTRACT_CREATED",
      expect.any(Function),
      10,
    );
  });

  it("계약 생성 시 TD에게는 알림을 보내지 않는다", async () => {
    const created = { id: 10, ...BASE_DTO };
    const createForTD = jest.fn().mockResolvedValue(undefined);
    const svc = makeService(
      { create: jest.fn().mockResolvedValue(created) },
      { createForTD },
    );
    await svc.createContract(BASE_DTO, 1);
    expect(createForTD).not.toHaveBeenCalled();
  });
});

// ─── #522: updateStatus → GM + TD 알림 ──────────────────────────────────────

describe("#522 ContractService.updateStatus — GM + TD 알림", () => {
  const CONTRACT = { id: 1, status: "PENDING" };

  it("상태 변경 시 GM에게 알림을 보낸다", async () => {
    const createForGM = jest.fn().mockResolvedValue(undefined);
    const svc = makeService(
      {
        findById: jest.fn().mockResolvedValue(CONTRACT),
        updateStatus: jest.fn().mockResolvedValue({ id: 1, status: "ACTIVE" }),
      },
      { createForGM },
    );
    await svc.updateStatus(1, { status: "ACTIVE" }, 1);
    expect(createForGM).toHaveBeenCalledWith("CONTRACT_STATUS_CHANGED", expect.any(Function), 1);
  });

  it("상태 변경 시 TD에게도 알림을 보낸다", async () => {
    const createForTD = jest.fn().mockResolvedValue(undefined);
    const svc = makeService(
      {
        findById: jest.fn().mockResolvedValue(CONTRACT),
        updateStatus: jest.fn().mockResolvedValue({ id: 1, status: "ACTIVE" }),
      },
      { createForTD },
    );
    await svc.updateStatus(1, { status: "ACTIVE" }, 1);
    expect(createForTD).toHaveBeenCalledWith("CONTRACT_STATUS_CHANGED", expect.any(Function), 1);
  });
});

// ─── #522: 조항 추가 → GM 알림 ───────────────────────────────────────────────

describe("#522 ContractService.addBuyout — GM 알림", () => {
  const CONTRACT = { id: 1, status: "ACTIVE" };

  it("바이아웃 추가 시 GM에게 알림을 보낸다", async () => {
    const createForGM = jest.fn().mockResolvedValue(undefined);
    const svc = makeService(
      {
        findById: jest.fn().mockResolvedValue(CONTRACT),
        hasBuyout: jest.fn().mockResolvedValue(null),
        createBuyout: jest.fn().mockResolvedValue({ id: 1 }),
      },
      { createForGM },
    );
    await svc.addBuyout(1, { amount: 5_000_000 }, 99);
    expect(createForGM).toHaveBeenCalledWith("CONTRACT_BUYOUT_ADDED", expect.any(Function), 1);
  });
});

describe("#522 ContractService.addExtension — GM 알림", () => {
  const CONTRACT = { id: 1, status: "ACTIVE" };

  it("연장옵션 추가 시 GM에게 알림을 보낸다", async () => {
    const createForGM = jest.fn().mockResolvedValue(undefined);
    const svc = makeService(
      {
        findById: jest.fn().mockResolvedValue(CONTRACT),
        createExtension: jest.fn().mockResolvedValue({ id: 1 }),
      },
      { createForGM },
    );
    await svc.addExtension(1, { condition: "CL", durationMonths: 12 }, 99);
    expect(createForGM).toHaveBeenCalledWith("CONTRACT_EXTENSION_ADDED", expect.any(Function), 1);
  });
});

describe("#522 ContractService.addBonus — GM 알림", () => {
  const CONTRACT = { id: 1, status: "ACTIVE" };

  it("성과보너스 추가 시 GM에게 알림을 보낸다", async () => {
    const createForGM = jest.fn().mockResolvedValue(undefined);
    const svc = makeService(
      {
        findById: jest.fn().mockResolvedValue(CONTRACT),
        createBonus: jest.fn().mockResolvedValue({ id: 1 }),
      },
      { createForGM },
    );
    await svc.addBonus(1, { amount: 1_000_000, description: "Goals" }, 99);
    expect(createForGM).toHaveBeenCalledWith("CONTRACT_BONUS_ADDED", expect.any(Function), 1);
  });
});
