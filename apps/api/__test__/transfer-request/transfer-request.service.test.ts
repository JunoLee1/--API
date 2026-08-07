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
  confirm: jest.fn(),
  delete: jest.fn(),
} as any;

const mockNotifRepo = {
  createForStaff: jest.fn(),
  createForGM: jest.fn(),
  createForUser: jest.fn(),
} as any;

const service = new TransferRequestService(mockRepo, mockNotifRepo);

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
    await expect(service.confirmStep(1, { action: "confirm" }, 30))
      .rejects.toMatchObject({ statusCode: 409, code: "CANNOT_CONFIRM_NON_APPROVED" });
  });

  test("confirmStep reject — rejectReason 없으면 400", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.APPROVED }));
    await expect(service.confirmStep(1, { action: "reject" }, 30))
      .rejects.toMatchObject({ statusCode: 400, code: "REJECT_REASON_REQUIRED" });
  });

  test("confirmStep confirm — 성공, AGENT + GM 알림 발송", async () => {
    const req = makeRequest({ status: TransferRequestStatus.APPROVED });
    mockRepo.findById.mockResolvedValue(req);
    mockRepo.confirm.mockResolvedValue(makeRequest({ status: TransferRequestStatus.CONFIRMED }));
    await service.confirmStep(1, { action: "confirm" }, 30);
    expect(mockNotifRepo.createForUser).toHaveBeenCalledWith(10, "TRANSFER_REQUEST_CONFIRMED", expect.any(Function), 1);
    expect(mockNotifRepo.createForGM).toHaveBeenCalledWith("TRANSFER_REQUEST_CONFIRMED", expect.any(Function), 1);
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
