import * as request from "supertest";
import app from "../src/app";

describe("라우팅 테스트", () => {
  test("GET /api", async () => {
    const res = await request(app).get("/api");

    expect(res.statusCode).toBe(200);
  });
});