import * as request from "supertest";
import app from "../../src/app";
import * as crypto from "../../src/lib/crypto";
import Service from "../../src/country/country.service";
import { getPrisma } from "../../src/lib/prisma";
import { ACCESS_TOKEN_COOKIE_NAME } from "../../src/lib/constants";

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
afterEach(async () => {
  const prisma = getPrisma();

  await prisma.user.deleteMany();
});
afterAll(async () => {
  const prisma = getPrisma();
  if (prisma) {
    await prisma.$disconnect();
  }
});
describe("auth routes test", () => {
  describe("POST auth login", () => {
    const Fakeuser = {
      email: "login@test.com",
      password: "12345678",
      confirmedPassword: "12345678",
      nickname: "loginUser",
      username: "loginUser",
      phoneNumber: "01099998888",
      nationality: { code: "KR" },
      team: { id: 1, teamname: "PusanFc" },
      date_of_birth: new Date("2010-06-10"),
      role: "ADMIN",
    };

    test("valid credential return token", async () => {
      //DB 테스트 저장값
      await request(app).post("/api/users/signUp").send(Fakeuser);

      //가짜 요청
      const res = await request(app).post("/api/users/login").send({
        email: Fakeuser.email,
        password: Fakeuser.password,
      });
      expect(res.status).toBe(201);
    });

    test("throw error message if email dose not exist", async () => {
      const res = await request(app)
        .post("/api/users/login")
        .send({
          ...Fakeuser,
          email: "junmo1@test.com",
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("INVALID USER EMAIL");
    });

    test("throw errror message if password is wrong", async () => {
      await request(app).post("/api/users/signUp").send(Fakeuser);
      const res = await request(app)
        .post("/api/users/login")
        .send({
          ...Fakeuser,
          password: "123456789",
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Wrong Password");
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
      role: "ADMIN",
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
      await request(app)
        .post("/api/users/signUp")
        .send({
          ...validUser,
          email: "p2@test.com",
          nickname: "JM",
        });
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

  describe("GET 단일 관리자 조회", () => {
    test("인증되지 않는 유저 인경우 401 UNAUTHORIZED 에러 던지기", async () => {
      const res = await request(app).get(`/api/users/1}`);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("UNAUTHORIZED");
    });

    test("슈퍼 관리자가 아닌경우 유저 인경우 403 에러 와 FORBIDDEN 메시지 던지기", async () => {
      const reqUser = {
        email: "login@test.com",
        password: "12345678",
        confirmedPassword: "12345678",
        nickname: "loginUser",
        username: "loginUser",
        phoneNumber: "01099998888",
        nationality: { code: "KR" },
        team: { id: 1, teamname: "PusanFc" },
        date_of_birth: new Date("2010-06-10"),
        role: "SUPER_ADMIN",
      };
      await request(app)
        .post("/api/users/signUp")
        .send({
          ...reqUser,
          role: "ADMIN",
        });
      const loginRes = await request(app).post("/api/users/login").send({
        email: reqUser.email,
        password: reqUser.password,
      });
      const token = loginRes.body.accessToken;
      const res = await request(app)
        .get("/api/users/1")
        .set("Cookie", [
          `${ACCESS_TOKEN_COOKIE_NAME}=${token}`,
          `otherCookie=abc`,
        ]);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe("FORBIDDEN");
    });

    test("성공적으로 데이터를 조회 했다면 200상태 와 메시지 확인", async () => {
      const uniqueId = Date.now();
      const prisma = getPrisma();
      const fakedmin = {
        email: `test_${uniqueId}@test.com`, // 절대 중복 안됨
        nickname: `nick_${uniqueId}`,
        phoneNumber: `010${String(uniqueId).slice(-8)}`,
        password: "12345678",
        confirmedPassword: "12345678",
        username: "login21User",
        nationality: { code: "KR" },
        team: { id: 1, teamname: "PusanFc" },
        date_of_birth: new Date("2010-06-10"),
        role: "SUPER_ADVISOR",
      };
      const signupRes = await request(app)
        .post("/api/users/signUp")
        .send(fakedmin);
      if (signupRes.status === 500) {
        console.error("서버에서 보낸 에러 본문:", signupRes.body);
      }
      expect(signupRes.status).toBe(201);

      const loginRes = await request(app).post("/api/users/login").send({
        email: fakedmin.email,
        password: fakedmin.password,
      });
      const createdUser = await prisma.user.findUnique({
        where: {
          email: fakedmin.email,
        },
      });
      const token = loginRes.body.accessToken;
      console.log("result:", loginRes.body);
      const targetId = createdUser!.id;
      console.log("targetid", targetId);
      const res = await request(app)
        .get(`/api/users/${targetId}`)
        .set("Cookie", [`${ACCESS_TOKEN_COOKIE_NAME}=${token}`]);
      expect(res.status).toBe(200);
    });
  });
});
