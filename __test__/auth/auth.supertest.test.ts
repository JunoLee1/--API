import * as request from "supertest";
import app from "../../src/app";
import * as crypto from "../../src/lib/crypto";
import Service from "../../src/country/country.service";
import { getPrisma } from "../../src/lib/prisma";

jest.mock("../../src/lib/crypto", () => ({
  encrypt: jest.fn(),
  decrypt: jest.fn(),
}));

jest.mock("../../src/country/country.service", () => ({
  default: jest.fn().mockImplementation(() => ({
    getCountryByCode: jest.fn().mockResolvedValue({
      code: "KR",
      name: "South Korea",
      region: "Asia",
    }),
  })),
}));
beforeEach(async () => {
  // 1️⃣ mock 설정
  (crypto.encrypt as jest.Mock).mockImplementation(
    async (phoneNumber: string) => ({
      iv: "mock_iv",
      encrypted: `enc_${phoneNumber}`,
    }),
  );

  // 2️⃣ DB 초기화
  const prisma = getPrisma();

  await prisma.user.deleteMany();
  await prisma.phoneNumber.deleteMany();
});
afterAll(async () => {
  const prisma = getPrisma();
  if (prisma) {
    await prisma.$disconnect();
  }
});
describe("auth routes test", () => {
  describe("POST auth login", () => {
    const user = {
    email: "login@test.com",
    password: "12345678",
    confirmedPassword: "12345678",
    nickname: "loginUser",
    username: "loginUser",
    phoneNumber: "01099998888",
    nationality: { code: "KR" },
    team: { id: 1, teamname: "PusanFc" },
    date_of_birth: new Date("2010-06-10"),
    };

    test("valid credential return token", async () => {
        //DB 테스트 저장값
        await request(app).post("/api/users/signUp").send(user);

        //가짜 요청
      const res = await request(app).post("/api/users/login").send({
        email:user.email,
        password:user.password
    });
      expect(res.status).toBe(201);
    });
    
    test("throw error message if email dose not exist", async () => {

      const res = await request(app)
        .post("/api/users/login")
        .send({
          ...user,
          email: "junmo1@test.com",
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("INVALID USER EMAIL")
    });

    test("throw errror message if password is wrong", async () => {
        await request(app).post("/api/users/signUp").send(user);
      const res = await request(app)
        .post("/api/users/login")
        .send({
          ...user,
          password: "123456789",
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Wrong Password")
    });
  });
  describe("POST signUp", () => {
    const validUser = {
      email: "new@test.com",
      password: "12345678",
      confirmedPassword: "12345678",
      nickname: "juno",
      username: "junolee",
      phoneNumber: "01011112222",
      team: {
        id: 1,
        teamname: "PusanFc",
      },
      nationality: {
        code: "KR",
      },
      date_of_birth: new Date("2010-06-10"),
    };
    test("email null 인경우 에러나와야한다", async () => {
      const res = await request(app)
        .post("/api/users/signUp")
        .send({
          ...validUser,
          email: null,
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("INVALID_EMAIL");
    });
    test("중복된 이메일인 경우 409에러 던지기", async () => {
      await request(app)
        .post("/api/users/signUp")
        .send({
          ...validUser,
          email: "junmo@test.com",
        });

      const res = await request(app)
        .post("/api/users/signUp")
        .send({
          ...validUser,
          email: "junmo@test.com",
        });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe("DUPLICATED_EMAIL");
    });
    test("유저 닉네임 중복시 에러던지기", async () => {
        await request(app).post("/api/users/signUp").send({
            ...validUser,
            email: "p2@test.com",
            nickname:"JM"
        })
      const res = await request(app)
        .post("/api/users/signUp")
        .send({
          ...validUser,
          email: "p1@test.com",
          nickname: "JM",
        });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe("DUPLICATED_NICKNAME");
    });
    test("비밀번호와 2차 비밀번호가 다른경우 에러던지기", async () => {
      const res = await request(app)
        .post("/api/users/signUp")
        .send({
          ...validUser,
          email: "pw@test.com",
          phoneNumber: "01055556666",
          confirmedPassword: "123456789",
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("PASSWORD_NOT_MATCH");
    });
    test("휴대폰 번호가 이미 존재하는 경우 409 에러던지기", async () => {
      await request(app)
        .post("/api/users/signUp")
        .send({
          ...validUser,
          email: "first@test.com",
          nickname: "first",
          username: "first",
          phoneNumber: "01011112222",
        });

      const res = await request(app)
        .post("/api/users/signUp")
        .send({
          ...validUser,
          email: "first1@test.com",
          phoneNumber: "01011112222",
          nickname: "first2",
        });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe("DUPLICATED PHONENUMBER");
    });
    test("성공적으로 계정 회원 가입 성공시 201던지기", async () => {
      const res = await request(app)
        .post("/api/users/signUp")
        .send({
          ...validUser,
          email: "kFc142@test.com",
          phoneNumber: "01082825311",
          nickname: "fu1243",
        });
      expect(res.status).toBe(201);
    });
  });
});
