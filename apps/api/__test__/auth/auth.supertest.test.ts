import request from "supertest";
import app from "../../src/app";
import { describe, test, jest, expect, beforeAll, afterAll } from "@jest/globals";

jest.mock("../../src/lib/crypto", () => ({
  encrypt: jest.fn(() => ({ encrypted: "enc", iv: "iv" })),
  decrypt: jest.fn(),
  validatePhoneEncryptionKey: jest.fn(),
}));

jest.mock("../../src/country/country.service", () => {
  const MockService = jest.fn().mockImplementation(() => ({
    getCountryByCode: jest.fn().mockResolvedValue({
      code: "KR",
      name: "South Korea",
      region: "Asia",
    }),
  }));
  return { __esModule: true, default: MockService };
});

describe("auth routes test", () => {
  describe("POST /api/auth/login", () => {
    test("credentials 없으면 400 계열 에러", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "",
        password: "",
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    test("존재하지 않는 이메일로 로그인 시도시 400 계열 에러", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "nonexistent_test_user_xyz@test.com",
        password: "somepassword",
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("GET /api/auth/me", () => {
    test("인증 없이 접근시 4xx 계열 에러", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("GET /api", () => {
    test("헬스체크 라우트 200", async () => {
      const res = await request(app).get("/api");
      expect(res.status).toBe(200);
    });
  });
});
