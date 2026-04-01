import {describe, test, jest} from "@jest/globals"
const authService = {
    login : jest.fn(),
    logout : jest.fn(),
    registration: jest.fn()
}
describe("인증 로직 테스트 - registry service", () => {
    test("respond 400 when registry fail",async() => {
        //
    })
    test("respond 404, when the email is duplicated or wrong type", async() => {
        //
    })
    test("respond 404, when the password is wrong type", async() => {
        //
    })
    test("respond 404, when the nickname is duplicated", async() => {
        //
    })
})
