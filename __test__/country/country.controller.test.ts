import { describe, test, jest, expect } from "@jest/globals";
import Controller from "../../src/country/country.controller";

const mockService = {
  getCountryByCode: jest.fn(),
  getCountries: jest.fn(),
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

//==========================================================================
describe("복수 국가 조회 컨트롤러 테스트", () => {
  test("서버 에러 인경우 500과 SERVER INTERNAL ERROR던지기", async () => {
    //Given
    const req = {
      query: {
        code: "KR",
        name: "South Korea",
        region: "Asia",
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockService.getCountries.mockRejectedValue([]);

    //When
    await controller.getCountries(req as any, res as any);
    //Then
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({message: "INTERNAL SERVER ERROR"});
  });
  test(`성공적으로 서비스 로직에서 값이 호출된경우 ${"성공적으로 데이터를 가지고 왔습니다."} 메시지와 결과인 배열이 전달 되는 지 확인`, async () => {
    //Given
    const req = {
      query: {
        code: "UK",
        name: "UNITED KINGDOM",
        region: "EUROUP",
      },
    };
    const res ={
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
    }
    const mockData = [
      {
        code: "UK",
        name: "UNITED KINGDOM",
        region: "EUROUP",
      },
    ];
    mockService.getCountries.mockResolvedValue(mockData);

    await controller.getCountries(req, res);

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
        message:"성공적으로 데이터를 가지고 왔습니다.",
        data: mockData
    })
  });
});
