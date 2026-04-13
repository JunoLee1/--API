import { describe, test, jest, expect } from "@jest/globals";
import Controller from "../../src/country/country.controller";

const mockService = {
  getCountryByCode: jest.fn(),
  getContries: jest.fn(),
} as any;

const controller = new Controller(mockService);

describe("특정 국가 조회", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test("서버 에러 인경우 500과 SERVER INTERNAL ERROR던지기", async () => {
    const req = {
      params: {
        code: "KR",
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockService.getCountryByCode.mockRejectedValue(new Error(""));

    await controller.getCountry(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "INTERNAL SERVER ERROR",
    });
  });
  test("성공적으로 데이터가 호출된경우 200 및 결과 값 리턴 확인", async () => {
    const req = {
      params: {
        code: "KR",
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const mockData = {
      code: "KR",
      name: "South Korea",
      region: "Asia",
    };
    mockService.getCountryByCode.mockResolvedValue(mockData);
    await controller.getCountry(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "성공적으로 데이터를 가지고 왔습니다.",
      data: mockData,
    });
  });
});
/*
//==========================================================================
describe("국가 조회", () => {
  test("서버 에러 인경우 500과 SERVER INTERNAL ERROR던지기", async () => {});
});

*/