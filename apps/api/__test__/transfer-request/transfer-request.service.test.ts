import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { TransferRequestService } from "../../src/transfer-request/transfer-request.service";
import { TransferRequestStatus } from "../../src/generated/enums";

const mockRepo = {
  findById: jest.fn(),
  findAll: jest.fn(),
  hasInProgress: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  submit: jest.fn(),
  review: jest.fn(),
  sendToMedical: jest.fn(),
  recordMedicalResult: jest.fn(),
  setRegistered: jest.fn(),
  addNegotiationLog: jest.fn(),
  getNegotiationLogs: jest.fn(),
  delete: jest.fn(),
} as any;

const mockNotifRepo = {
  createForStaff: jest.fn(),
  createForGM: jest.fn(),
  createForUser: jest.fn(),
  createForMedicalStaff: jest.fn(),
} as any;

const mockWageCap = {
  check: jest.fn().mockResolvedValue({ status: "OK" }),
} as any;

const service = new TransferRequestService(mockRepo, mockNotifRepo, mockWageCap);

const makeRequest = (overrides = {}) => ({
  id: 1,
  status: TransferRequestStatus.DRAFT,
  playerId: "p1",
  agencyId: 1,
  requestedBy: { id: 10, username: "agent1" },
  type: "PERMANENT_OUT",
  ...overrides,
});

describe("TransferRequestService", () => {
  beforeEach(() => jest.clearAllMocks());

  test("create — 진행 중 요청 있으면 409", async () => {
    mockRepo.hasInProgress.mockResolvedValue({ id: 99 });
    await expect(service.create({ playerId: "p1", agencyId: 1, type: "PERMANENT_OUT" as any }, 10))
      .rejects.toMatchObject({ statusCode: 409, code: "TRANSFER_REQUEST_IN_PROGRESS" });
  });

  test("create — 성공", async () => {
    mockRepo.hasInProgress.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(makeRequest());
    const result = await service.create({ playerId: "p1", agencyId: 1, type: "PERMANENT_OUT" as any }, 10);
    expect(result.id).toBe(1);
    expect(mockRepo.create).toHaveBeenCalledWith({ playerId: "p1", agencyId: 1, type: "PERMANENT_OUT" }, 10);
  });

  test("update — DRAFT가 아니면 409", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.PENDING_APPROVAL }));
    await expect(service.update(1, {}))
      .rejects.toMatchObject({ statusCode: 409, code: "CANNOT_MODIFY_NON_DRAFT" });
  });

  test("submit — DRAFT가 아니면 409", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.APPROVED }));
    await expect(service.submit(1, 10))
      .rejects.toMatchObject({ statusCode: 409, code: "CANNOT_SUBMIT_NON_DRAFT" });
  });

  test("submit — 본인이 아니면 403", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ requestedBy: { id: 99, username: "other" } }));
    await expect(service.submit(1, 10))
      .rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
  });

  test("submit — 성공, FRONT_OFFICE 알림 발송", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest());
    mockRepo.submit.mockResolvedValue(makeRequest({ status: TransferRequestStatus.PENDING_APPROVAL }));
    await service.submit(1, 10);
    expect(mockRepo.submit).toHaveBeenCalledWith(1);
    expect(mockNotifRepo.createForStaff).toHaveBeenCalledWith(
      "TRANSFER_REQUEST_SUBMITTED",
      expect.any(Function),
      1,
    );
  });

  test("review — PENDING_APPROVAL이 아니면 409", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.DRAFT }));
    await expect(service.review(1, { action: "approve" }, 20))
      .rejects.toMatchObject({ statusCode: 409, code: "CANNOT_REVIEW_NON_PENDING" });
  });

  test("review reject — rejectReason 없으면 400", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.PENDING_APPROVAL }));
    await expect(service.review(1, { action: "reject" }, 20))
      .rejects.toMatchObject({ statusCode: 400, code: "REJECT_REASON_REQUIRED" });
  });

  test("review approve — 성공, AGENT 알림 발송", async () => {
    const req = makeRequest({ status: TransferRequestStatus.PENDING_APPROVAL });
    mockRepo.findById.mockResolvedValue(req);
    mockRepo.review.mockResolvedValue(makeRequest({ status: TransferRequestStatus.APPROVED }));
    await service.review(1, { action: "approve" }, 20);
    expect(mockNotifRepo.createForUser).toHaveBeenCalledWith(10, "TRANSFER_REQUEST_APPROVED", expect.any(Function), 1);
  });

  test("confirmStep — APPROVED가 아니면 409", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.PENDING_APPROVAL }));
    await expect(service.confirmStep(1, { action: "send-to-medical" }, 30))
      .rejects.toMatchObject({ statusCode: 409, code: "CANNOT_CONFIRM_NON_APPROVED" });
  });

  test("confirmStep reject — rejectReason 없으면 400", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.APPROVED }));
    await expect(service.confirmStep(1, { action: "reject" }, 30))
      .rejects.toMatchObject({ statusCode: 400, code: "REJECT_REASON_REQUIRED" });
  });

  test("confirmStep send-to-medical — 성공, 메디컬 스태프 알림 발송", async () => {
    const req = makeRequest({ status: TransferRequestStatus.APPROVED });
    mockRepo.findById.mockResolvedValue(req);
    mockRepo.sendToMedical.mockResolvedValue(makeRequest({ status: TransferRequestStatus.MEDICAL_PENDING }));
    await service.confirmStep(1, { action: "send-to-medical" }, 30);
    expect(mockRepo.sendToMedical).toHaveBeenCalledWith(1);
    expect(mockNotifRepo.createForMedicalStaff).toHaveBeenCalledWith("TRANSFER_MEDICAL_REQUIRED", expect.any(Function), 1);
  });

  test("delete — DRAFT가 아니면 409", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.PENDING_APPROVAL }));
    await expect(service.delete(1, 10))
      .rejects.toMatchObject({ statusCode: 409, code: "CANNOT_DELETE_NON_DRAFT" });
  });

  test("delete — 본인이 아니면 403", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ requestedBy: { id: 99, username: "other" } }));
    await expect(service.delete(1, 10))
      .rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
  });
});

// ─── recordMedicalResult ──────────────────────────────────────────────────────

describe("TransferRequestService.recordMedicalResult", () => {
  beforeEach(() => jest.clearAllMocks());

  test("MEDICAL_PENDING이 아니면 409", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.APPROVED }));
    await expect(service.recordMedicalResult(1, { result: "pass" }, 40))
      .rejects.toMatchObject({ statusCode: 409, code: "CANNOT_RECORD_MEDICAL_NON_PENDING" });
  });

  test("fail — medicalNotes 없으면 400", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.MEDICAL_PENDING }));
    await expect(service.recordMedicalResult(1, { result: "fail" }, 40))
      .rejects.toMatchObject({ statusCode: 400, code: "MEDICAL_NOTES_REQUIRED" });
  });

  test("pass — 성공, CONFIRMED, requestedBy + GM 알림", async () => {
    const req = makeRequest({ status: TransferRequestStatus.MEDICAL_PENDING });
    mockRepo.findById.mockResolvedValue(req);
    mockRepo.recordMedicalResult.mockResolvedValue(makeRequest({ status: TransferRequestStatus.CONFIRMED }));
    await service.recordMedicalResult(1, { result: "pass" }, 40);
    expect(mockRepo.recordMedicalResult).toHaveBeenCalledWith(1, { result: "pass" });
    expect(mockNotifRepo.createForUser).toHaveBeenCalledWith(10, "TRANSFER_REQUEST_CONFIRMED", expect.any(Function), 1);
    expect(mockNotifRepo.createForGM).toHaveBeenCalledWith("TRANSFER_REQUEST_CONFIRMED", expect.any(Function), 1);
  });

  test("fail — 성공, REJECTED, requestedBy 알림", async () => {
    const req = makeRequest({ status: TransferRequestStatus.MEDICAL_PENDING });
    mockRepo.findById.mockResolvedValue(req);
    mockRepo.recordMedicalResult.mockResolvedValue(makeRequest({ status: TransferRequestStatus.REJECTED }));
    await service.recordMedicalResult(1, { result: "fail", medicalNotes: "심장 이상" }, 40);
    expect(mockNotifRepo.createForUser).toHaveBeenCalledWith(10, "TRANSFER_REQUEST_REJECTED", expect.any(Function), 1);
  });
});

// ─── register ─────────────────────────────────────────────────────────────────

describe("TransferRequestService.register", () => {
  beforeEach(() => jest.clearAllMocks());

  test("CONFIRMED이 아니면 409", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.MEDICAL_PENDING }));
    await expect(service.register(1))
      .rejects.toMatchObject({ statusCode: 409, code: "CANNOT_REGISTER_NON_CONFIRMED" });
  });

  test("이미 registeredAt 있으면 409", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.CONFIRMED, registeredAt: new Date() }));
    await expect(service.register(1))
      .rejects.toMatchObject({ statusCode: 409, code: "ALREADY_REGISTERED" });
  });

  test("성공 — setRegistered 호출", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.CONFIRMED, registeredAt: null }));
    mockRepo.setRegistered.mockResolvedValue(makeRequest({ status: TransferRequestStatus.CONFIRMED, registeredAt: new Date() }));
    const result = await service.register(1);
    expect(mockRepo.setRegistered).toHaveBeenCalledWith(1);
    expect(result).toBeDefined();
  });

  test("성공 — requestedBy에게 TRANSFER_REGISTERED 알림 발송", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.CONFIRMED, registeredAt: null }));
    mockRepo.setRegistered.mockResolvedValue(makeRequest({ status: TransferRequestStatus.CONFIRMED, registeredAt: new Date() }));
    await service.register(1);
    expect(mockNotifRepo.createForUser).toHaveBeenCalledWith(10, "TRANSFER_REGISTERED", expect.any(Function), 1);
  });
});

// ─── addNegotiationLog ────────────────────────────────────────────────────────

describe("TransferRequestService.addNegotiationLog", () => {
  beforeEach(() => jest.clearAllMocks());

  test("DRAFT이면 409 — 협상 로그는 APPROVED 이후만", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.DRAFT }));
    await expect(service.addNegotiationLog(1, { type: "CLUB_TO_CLUB", note: "첫 제안", amount: 5_000_000 }, 30))
      .rejects.toMatchObject({ statusCode: 409, code: "CANNOT_LOG_NEGOTIATION_ON_NON_ACTIVE" });
  });

  test("APPROVED이면 성공 — addNegotiationLog 호출", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.APPROVED }));
    const log = { id: 1, type: "CLUB_TO_CLUB", note: "첫 제안", amount: 5_000_000 };
    mockRepo.addNegotiationLog.mockResolvedValue(log);
    const result = await service.addNegotiationLog(1, { type: "CLUB_TO_CLUB", note: "첫 제안", amount: 5_000_000 }, 30);
    expect(mockRepo.addNegotiationLog).toHaveBeenCalledWith(1, { type: "CLUB_TO_CLUB", note: "첫 제안", amount: 5_000_000 }, 30);
    expect(result.id).toBe(1);
  });
});

// ─── submit WageCap check ─────────────────────────────────────────────────────

describe("TransferRequestService.submit — WageCap", () => {
  beforeEach(() => jest.clearAllMocks());

  test("PERMANENT_IN + expectedSalary → wageCap.check 호출", async () => {
    const req = makeRequest({ status: TransferRequestStatus.DRAFT, type: "PERMANENT_IN", expectedSalary: 80_000 });
    mockRepo.findById.mockResolvedValue(req);
    mockRepo.submit.mockResolvedValue({ ...req, status: TransferRequestStatus.PENDING_APPROVAL });
    mockWageCap.check.mockResolvedValue({ status: "WARNING", percentOver: 15 });
    const result = await service.submit(1, 10);
    expect(mockWageCap.check).toHaveBeenCalledWith(80_000);
    expect(result.wageCapWarning).toEqual({ status: "WARNING", percentOver: 15 });
  });

  test("PERMANENT_OUT → wageCap.check 호출 안 함", async () => {
    const req = makeRequest({ status: TransferRequestStatus.DRAFT, type: "PERMANENT_OUT" });
    mockRepo.findById.mockResolvedValue(req);
    mockRepo.submit.mockResolvedValue({ ...req, status: TransferRequestStatus.PENDING_APPROVAL });
    await service.submit(1, 10);
    expect(mockWageCap.check).not.toHaveBeenCalled();
  });
});
