import { describe, expect, jest, test } from "@jest/globals";
import { Request, Response, NextFunction } from "express";
import { AuthController } from "../../src/auth/auth.controller";

describe("AuthController.me", () => {
  test("인증 정보가 없으면 401 UNAUTHORIZED를 전달한다", async () => {
    const service = {
      me: jest.fn(),
    } as any;
    const controller = new AuthController(service);

    const req = { user: null } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    await controller.me(req, res, next);

    expect(service.me).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: "UNAUTHORIZED",
      }),
    );
  });
});
