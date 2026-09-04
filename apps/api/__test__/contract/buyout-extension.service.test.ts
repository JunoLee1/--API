import { ContractService } from "../../src/contract/contract.service";

jest.mock("../../src/lib/auditLog", () => ({ writeAuditLog: jest.fn().mockResolvedValue(undefined) }));

const makeRepo = (overrides: Record<string, unknown> = {}) => ({
  findById: jest.fn(),
  hasBuyout: jest.fn(),
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

const makeWageCap = () => ({
  check: jest.fn().mockResolvedValue({ status: "OK" }),
});

const makeService = (repoOverrides = {}) =>
  new ContractService(makeRepo(repoOverrides) as any, makeWageCap() as any);

// ─── getActiveBuyout ────────────────────────────────────────────────────────

describe("ContractService.getActiveBuyout", () => {
  it("returns the buyout clause when validUntil is null (no expiry)", async () => {
    const clause = { id: 1, amount: BigInt(5_000_000), validUntil: null };
    const svc = makeService({ findActiveBuyout: jest.fn().mockResolvedValue(clause) });
    expect(await svc.getActiveBuyout(1)).toEqual(clause);
  });

  it("returns the buyout clause when validUntil is in the future", async () => {
    const future = new Date(Date.now() + 86_400_000);
    const clause = { id: 1, amount: BigInt(5_000_000), validUntil: future };
    const svc = makeService({ findActiveBuyout: jest.fn().mockResolvedValue(clause) });
    expect(await svc.getActiveBuyout(1)).toEqual(clause);
  });

  it("returns null when validUntil is in the past (expired)", async () => {
    const svc = makeService({ findActiveBuyout: jest.fn().mockResolvedValue(null) });
    expect(await svc.getActiveBuyout(1)).toBeNull();
  });
});

// ─── addBuyout with validUntil ───────────────────────────────────────────────

describe("ContractService.addBuyout — validUntil", () => {
  const CONTRACT = { id: 1, status: "ACTIVE" };

  it("stores validUntil when provided", async () => {
    const validUntil = "2027-06-30";
    const createBuyout = jest.fn().mockResolvedValue({ id: 1, amount: 1_000_000, validUntil: new Date(validUntil) });
    const svc = makeService({
      findById: jest.fn().mockResolvedValue(CONTRACT),
      hasBuyout: jest.fn().mockResolvedValue(null),
      createBuyout,
    });
    await svc.addBuyout(1, { amount: 1_000_000, validUntil }, 99);
    expect(createBuyout).toHaveBeenCalledWith(1, { amount: 1_000_000, validUntil });
  });

  it("stores without validUntil when omitted", async () => {
    const createBuyout = jest.fn().mockResolvedValue({ id: 1, amount: 2_000_000, validUntil: null });
    const svc = makeService({
      findById: jest.fn().mockResolvedValue(CONTRACT),
      hasBuyout: jest.fn().mockResolvedValue(null),
      createBuyout,
    });
    await svc.addBuyout(1, { amount: 2_000_000 }, 99);
    expect(createBuyout).toHaveBeenCalledWith(1, { amount: 2_000_000 });
  });
});

// ─── addExtension with conditionText / minAppearances ───────────────────────

describe("ContractService.addExtension — conditionText / minAppearances", () => {
  const CONTRACT = { id: 1, status: "ACTIVE" };

  it("stores conditionText when provided", async () => {
    const createExtension = jest.fn().mockResolvedValue({ id: 1 });
    const svc = makeService({
      findById: jest.fn().mockResolvedValue(CONTRACT),
      createExtension,
    });
    await svc.addExtension(1, { condition: "Champions League", durationMonths: 12, conditionText: "CL qualification required" }, 99);
    expect(createExtension).toHaveBeenCalledWith(1, expect.objectContaining({ conditionText: "CL qualification required" }));
  });

  it("stores minAppearances when provided", async () => {
    const createExtension = jest.fn().mockResolvedValue({ id: 1 });
    const svc = makeService({
      findById: jest.fn().mockResolvedValue(CONTRACT),
      createExtension,
    });
    await svc.addExtension(1, { condition: "appearances", durationMonths: 12, minAppearances: 20 }, 99);
    expect(createExtension).toHaveBeenCalledWith(1, expect.objectContaining({ minAppearances: 20 }));
  });

  it("passes through without optional fields when neither provided", async () => {
    const createExtension = jest.fn().mockResolvedValue({ id: 1 });
    const svc = makeService({
      findById: jest.fn().mockResolvedValue(CONTRACT),
      createExtension,
    });
    await svc.addExtension(1, { condition: "standard", durationMonths: 6 }, 99);
    expect(createExtension).toHaveBeenCalledWith(1, { condition: "standard", durationMonths: 6 });
  });
});
