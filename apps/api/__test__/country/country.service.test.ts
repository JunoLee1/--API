import { describe, test, jest, expect } from "@jest/globals";
import Service from "../../src/country/country.service";
import { CountryApiClient } from "../../src/externalAPI";
const mockRepo = {
  getCountryByCode: jest.fn(),
  getCountries: jest.fn(),
} as any;

const mockCountryApiClient = {
  getAllCountries: jest.fn(),
  getCountryByCode: jest.fn(),
  getCountries: jest.fn(),
} as any;
const service = new Service(mockCountryApiClient, mockRepo);

describe("코드로 단일 국가 조회", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test("해당 코드가 존재하지 않는 경우 invalid code 나오는지 확인", async () => {
    //Given
    mockRepo.getCountryByCode.mockResolvedValue(null);
    // When + then
    await expect(service.getCountryByCode).rejects.toThrow("invalid code");
  });
  test("DB 데이터와 외부 데이터가 없는 경우", async () => {
    mockRepo.getCountryByCode.mockResolvedValue(null);
    mockCountryApiClient.getCountryByCode.mockResolvedValue(null);

    await expect(service.getCountryByCode("KR")).rejects.toThrow(
      "invalid country",
    );
  });
  test("DB에 데이터가 없는 경우, 외부 API사용", async () => {
    const fakeCountry = {
      code: "KR",
      region: "Asia",
      name: "South Korea",
    };
    mockRepo.getCountryByCode.mockResolvedValue(null);
    mockCountryApiClient.getCountryByCode.mockResolvedValue({
      code: "KR",
      region: "Asia",
      name: "South Korea",
    });
    const result = await service.getCountryByCode("KR");
    expect(result).toEqual(fakeCountry);
  });

  test("성공적으로 단일 국가가 조회되는지 확인", async () => {
    // Given
    const fakeCountry = {
      code: "KR",
      name: "South Korea",
      region: "Asia",
    };
    mockRepo.getCountryByCode.mockResolvedValue(fakeCountry);
    // When
    const result = await service.getCountryByCode(fakeCountry.code);
    // Then
    expect(result).toEqual(fakeCountry);
  });
});

describe("복수 국가 조회 테스트", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test("DB 와 외부 API 둘다 데이터가 없는 경우, 빈 배열 반환", async () => {
    mockRepo.getCountries.mockResolvedValue([]);
    mockCountryApiClient.getAllCountries.mockResolvedValue([]);

    const result = await service.getCountries({ name: "South Korea", code: "KR", region: "Asia" });
    expect(result).toEqual([]);
  });
  test("DB엔 데이터가 없지만 외부 API 에 있는경우, 등록 후 repo 결과 반환", async () => {
    const countries = [
      {
        name: "South Korea",
        code: "KR",
        region: "Asia",
      },
      {
        name: "Japan",
        code: "JP",
        region: "Asia",
      },
    ];
    mockRepo.getCountries
      .mockResolvedValueOnce([])      // first call: total count check
      .mockResolvedValueOnce(countries); // second call: filtered result
    mockRepo.saveCountries = jest.fn().mockResolvedValue(undefined);
    mockCountryApiClient.getAllCountries.mockResolvedValue(
      countries.map((c) => ({ cca2: c.code, name: { common: c.name }, region: c.region }))
    );

    const result = await service.getCountries({ region: "Asia" });

    expect(result).toEqual(countries);
  });
  //test("DB 데이터 있는 경우, 결과값 던지기", async () => {})
});
