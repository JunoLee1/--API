import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { TransferRequestController } from "../../src/transfer-request/transfer-request.controller";

const mockService = {
  list: jest.fn().mockResolvedValue([]),
  getById: jest.fn().mockResolvedValue({ id: 1 }),
  create: jest.fn().mockResolvedValue({ id: 1 }),
  update: jest.fn().mockResolvedValue({ id: 1 }),
  submit: jest.fn().mockResolvedValue({ id: 1 }),
  review: jest.fn().mockResolvedValue({ id: 1 }),
  confirmStep: jest.fn().mockResolvedValue({ id: 1 }),
  delete: jest.fn().mockResolvedValue({ id: 1 }),
} as any;

const controller = new TransferRequestController(mockService);

const mockReq = (overrides: any) => ({
  user: { id: 1, role: "AGENT", coachingRole: null, frontOfficeRole: null },
  body: {},
  params: {},
  query: {},
  ...overrides,
}) as any;

const mockRes = () => {
  const r: any = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};

const next = jest.fn() as any;

describe("TransferRequestController", () => {
  beforeEach(() => jest.clearAllMocks());

  test("create — AGENT → 201", async () => {
    const req = mockReq({ user: { id: 1, role: "AGENT" }, body: { playerId: "p1", agencyId: 1, type: "PERMANENT_OUT" } });
    const res = mockRes();
    await controller.create(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockService.create).toHaveBeenCalled();
  });

  test("create — COACHING_STAFF → 403", async () => {
    const req = mockReq({ user: { id: 2, role: "COACHING_STAFF" }, body: {} });
    const res = mockRes();
    await controller.create(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  test("update — AGENT → 200", async () => {
    const req = mockReq({ user: { id: 1, role: "AGENT" }, params: { id: "1" }, body: { fee: 500000 } });
    const res = mockRes();
    await controller.update(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("update — GM → 403", async () => {
    const req = mockReq({ user: { id: 2, role: "GM" }, params: { id: "1" }, body: {} });
    const res = mockRes();
    await controller.update(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  test("submit — AGENT → 200", async () => {
    const req = mockReq({ user: { id: 1, role: "AGENT" }, params: { id: "1" } });
    const res = mockRes();
    await controller.submit(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockService.submit).toHaveBeenCalledWith(1, 1);
  });

  test("review — FRONT_OFFICE → 200", async () => {
    const req = mockReq({ user: { id: 2, role: "FRONT_OFFICE" }, params: { id: "1" }, body: { action: "approve" } });
    const res = mockRes();
    await controller.review(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockService.review).toHaveBeenCalledWith(1, { action: "approve" }, 2);
  });

  test("review — AGENT → 403", async () => {
    const req = mockReq({ user: { id: 1, role: "AGENT" }, params: { id: "1" }, body: {} });
    const res = mockRes();
    await controller.review(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  test("confirm — GM → 200", async () => {
    const req = mockReq({ user: { id: 3, role: "GM" }, params: { id: "1" }, body: { action: "confirm" } });
    const res = mockRes();
    await controller.confirm(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockService.confirmStep).toHaveBeenCalledWith(1, { action: "confirm" }, 3);
  });

  test("confirm — ADMIN → 200", async () => {
    const req = mockReq({ user: { id: 4, role: "ADMIN" }, params: { id: "1" }, body: { action: "confirm" } });
    const res = mockRes();
    await controller.confirm(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("confirm — FRONT_OFFICE → 403", async () => {
    const req = mockReq({ user: { id: 5, role: "FRONT_OFFICE" }, params: { id: "1" }, body: {} });
    const res = mockRes();
    await controller.confirm(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  test("delete — AGENT → 200", async () => {
    const req = mockReq({ user: { id: 1, role: "AGENT" }, params: { id: "1" } });
    const res = mockRes();
    await controller.remove(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockService.delete).toHaveBeenCalledWith(1, 1);
  });
});
