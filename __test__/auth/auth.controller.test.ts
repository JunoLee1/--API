import { describe, test, jest, expect } from "@jest/globals";
import AuthController from "../../src/auth/auth.controller";
const authService = {
  login: jest.fn(),
  logout: jest.fn(),
  signUp: jest.fn(),
} as any; // 임시

const controller = new AuthController(authService);
describe("인증 로직 테스트 - registry service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test("respond 201 when registry success", async () => {
    const req = { body: { email: "test@test.com" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.signUp(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(authService.signUp).toHaveBeenCalled();
  });
  test("respond 400 when registry fail", async () => {
    const req = { body: { email: "test@test.com" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    authService.signUp.mockRejectedValue(new Error("Something Wrong"));

    await controller.signUp(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Something Wrong",
    });
  });
});
//=========================================================================

describe("인증 로직 테스트 - login controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test("로그인에 성공한 경우, 200 상태코드 던지기", async () => {
    const req = { body: { email: "test@test.com", password: "12345567" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    authService.login.mockResolvedValue({ email: "test@test.com" });
    await controller.login(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ email: "test@test.com" });
  });
  test("로그인에 실패한 경우, 500에러와 '알수없는 에러' 메시지 던지기", async () => {
    const req = { body: { email: "test@test.com", password: "12345567" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    authService.login.mockRejectedValue(new Error("Something Wrong"));
    await controller.login(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Something Wrong",
    });
  });
});
//======================================================================================
