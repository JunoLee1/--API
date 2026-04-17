import axios from "axios";
import Service from "../src/country/country.service";
import { CountryApiClient } from "../src/externalAPI";

jest.mock("axios");
const mockRepo = {
  getCountryByCode: jest.fn(),
  getAllCountries:jest.fn(),
  getCountries: jest.fn(),
} as any;

const client = new CountryApiClient();

const service = new Service(mockRepo);

const mockedAxios = axios as jest.Mocked<typeof axios>;
describe("외부 API 테스트", () => {
  beforeEach(() =>{
    jest.clearAllMocks();
  }) 
  test("전체 국가 조회 - 외부 API 테스트", async () => {
    mockedAxios.get.mockResolvedValue({
      data: [{ name: "South Korea" }],
    } as any);

    const result = await client.getAllCountries();
    expect(result).toEqual([{ name: "South Korea" }]);
  });
});
