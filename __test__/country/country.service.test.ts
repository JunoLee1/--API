import { describe, test, jest, expect } from "@jest/globals";
import Service from "../../src/country/country.service"

const mockRepo = {
    getCountryByCode:jest.fn(),
    getCountries:jest.fn()
} as any;

const service = new Service(mockRepo)

describe("코드로 단일 국가 조회", () => {
    test("해당 코드가 존재하지 않는 경우 invalid code 나오는지 확인", async() => {
        //Given
        const fakeCountry = {
            code: null
        }
        mockRepo.getCountryByCode.mockResolvedValue(null)
        // When + then
        await expect(service.getCountryByCode).rejects.toThrow("invalid code")
    })

    test("성공적으로 단일 국가가 조회되는지 확인", async() => {
        // Given
        const fakeCountry = {
            code:"KR",
            name:"South Korea",
            region: "Asia"
        }
        mockRepo.getCountryByCode.mockResolvedValue(fakeCountry)
        // When 
        const result = await service.getCountryByCode(fakeCountry.code)
        // Then
        expect(result).toBe(fakeCountry)
    })
})
/*
describe("복수 국가 조회 테스트", () => {
    test("", async() => {
        // Given
        const mockData = [{
            code: 
        }]
        // When 
        // Then
    })
/*
    test("", async() => {
        // Given
        // When 
        // Then
    })
       
})
*/