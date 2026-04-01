import { describe, test, jest, expect } from "@jest/globals";
import AuthController from "../../src/auth/auth.controller";
const authService = {
  login: jest.fn(),
  logout: jest.fn(),
  create: jest.fn(),
} as any; // 임시

const controller = new AuthController(authService);
describe("인증 로직 테스트 - registry service", () => {
  test("respond 201 when registry success", async () => {
    const result = jest.spyOn(authService, "create").mockResolvedValue({
      id: 1,
      email: "example@test.com",
      password: "12345678",
    });
    const req = { body: { email: "test@test.com" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.create(req as any, res as any);
    expect(authService.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
  test("respond 400 when registry fail", async () => {
    const req = { body: { email: "test@test.com" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    authService.create.mockRejectedValue(new Error("Something Wrong"))

    await controller.create(req as any, res as any)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
        message: "Something Wrong"
    })
  });
});
//=========================================================================

