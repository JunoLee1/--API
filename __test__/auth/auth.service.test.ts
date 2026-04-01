import { describe, test, jest } from "@jest/globals";
import AuthService from "../../src/auth/auth.service";

const MockRepo = {
  create: jest.fn(),
  isEmailDuplicated: jest.fn(),
  isNicknameDuplicated: jest.fn(),
} as any;

const service = new AuthService(MockRepo);
describe("인증 로직 테스트 - registry service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test("respond 404, when the email is emty", async () => {
    await expect(
      service.create({ email: "", password: "1234", nickname: "jun" }),
    ).rejects.toThrow("INVALID_EMAIL");
  });

  test("respond 404, when the email is duplicated", async () => {
    MockRepo.isEmailDuplicated.mockResolvedValue({
      email: "test@test.com",
    });
    await expect(
      service.create({
        email: "test@test.com",
        password: "1234",
        nickname: "jun",
      }),
    ).rejects.toThrow("DUPLICATED_EMAIL");
  });

  test("respond 404, when the nickname is empty", async () => {
    await expect(
      service.create({
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
      service.create({
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
      service.create({ email: "email@email.com", password: "", nickname: "j" }),
    ).rejects.toThrow("INVALID_PASSWORD");
  });
  test("respons Unmatched Pwd, if confirmed password", async() => {
    await expect(
        service.create({
            email: "email1@email.com",
            password: "1234",
            confirmPassword: "12345",
            nickname: "Juno",
        })
    ).rejects.toThrow("PASSWORD_NOT_MATCH");
  })
});
//===================================================================================
