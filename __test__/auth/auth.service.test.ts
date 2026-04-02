import { describe, test, jest } from "@jest/globals";
import AuthService from "../../src/auth/auth.service";

const MockRepo = {
  create: jest.fn(),
  isEmailDuplicated: jest.fn(),
  isNicknameDuplicated: jest.fn(),
  findUniqueEmail: jest.fn(),
  findUnique:jest.fn()
} as any;

const service = new AuthService(MockRepo);
describe("인증 로직 테스트 - registry service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test("respond 404, when the email is emty", async () => {
    await expect(
      service.signUp({ email: "", password: "1234", nickname: "jun" }),
    ).rejects.toThrow("INVALID_EMAIL");
  });

  test("respond 404, when the email is duplicated", async () => {
    MockRepo.isEmailDuplicated.mockResolvedValue({
      email: "test@test.com",
    });
    await expect(
      service.signUp({
        email: "test@test.com",
        password: "1234",
        nickname: "jun",
      }),
    ).rejects.toThrow("DUPLICATED_EMAIL");
  });

  test("respond 404, when the nickname is empty", async () => {
    await expect(
      service.signUp({
        email: "email@email.com",
        password: "1234",
        nickname: "",
      }),
    ).rejects.toThrow("INVALID_NICKNAME");
  });

  test("respond 404, when the nickname is duplicated", async () => {
    MockRepo.isEmailDuplicated.mockResolvedValue(false);
    MockRepo.isNicknameDuplicated.mockResolvedValue(true);

    await expect(
      service.signUp({
        email: "email1@email.com",
        password: "1234",
        nickname: "Juno",
      }),
    ).rejects.toThrow("DUPLICATED_NICKNAME");
  });

  test("respond 404, when the password is empty", async () => {
    MockRepo.isEmailDuplicated.mockResolvedValue(false);
    MockRepo.isNicknameDuplicated.mockResolvedValue(false);

    await expect(
      service.signUp({ email: "email@email.com", password: "", nickname: "j" }),
    ).rejects.toThrow("INVALID_PASSWORD");
  });
  test("respons Unmatched Pwd, if confirmed password", async() => {
    await expect(
        service.signUp({
            email: "email1@email.com",
            password: "1234",
            confirmPassword: "12345",
            nickname: "Juno",
        })
    ).rejects.toThrow("PASSWORD_NOT_MATCH");
  })
});
//===================================================================================

describe("인증 로직 테스트 - login service", () => {
    test("EMAIL이 DB에 없는 경우 NOT FOUND 에러 던지기", async() => {
        MockRepo.findUniqueEmail.mockResolvedValue(null)
        await expect(
            service.login({
                email:"test@example.com",
                password:"1233"
            })
        ).rejects.toThrow("NOT FOUND")
    })

    test("비밀번호가 DB에 있는 비밀번호와 다른 경우, 401에러 던지기", async() => {
        MockRepo.findUniqueEmail.mockResolvedValue(true)
        
        const fakeUser = {
            email:"test@example.com",
            password:"1234"
        }

        MockRepo.findUnique.mockResolvedValue(fakeUser);
        await expect(
            service.login({
                email:"test@example.com",
                password:"12345"
            })
        ).rejects.toThrow("Wrong Password")
    })
})

//======================================================================================

