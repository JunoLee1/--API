import { describe, test, jest } from "@jest/globals";
import AuthService from "../../src/auth/auth.service";
import * as token from "../../src/lib/token";
import * as hash from "../../src/lib/hash";
import * as crypto from "../../src/lib/crypto";
import { IAuth, Role, Status } from "../../src/auth/auth.DTO";

const MockRepo = {
  createAdmin: jest.fn(),
  isEmailDuplicated: jest.fn(),
  isNicknameDuplicated: jest.fn(),
  findUniqueEmail: jest.fn(),
  findUnique: jest.fn(),
  findAdvisorById: jest.fn(),
  findAdvisors: jest.fn(),
  updatesAdvisor: jest.fn(),
  updateAdvisors: jest.fn(),
  updateAdvisorsStatus: jest.fn(),
  findAdvisorsByIds: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  findByEmail: jest.fn(),
} as any;

jest.mock("../../src/lib/token", () => ({
  generateToken: jest.fn(() => "fake.jwt.token"),
}));

jest.mock("../../src/lib/hash", () => ({
  match: jest.fn(),
  hashedPassword: jest.fn(),
}));

jest.mock("../../src/lib/crypto", () =>({
  encrypt: jest.fn(),
  decrypt: jest.fn()
}))
const service = new AuthService(MockRepo);
describe("인증 로직 테스트 - registry service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
  test("respond 404, when the email is emty", async () => {
    await expect(
      service.signUp({
        email: "",
        password: "1234",
        nickname: "jun",
        confirmedPassword: "1234",
        username: "junoLee",
        countriesId: 1,
        phoneNumber : "01011112222"
      }),
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
        username: "junoLee",
        confirmedPassword: "1234",
        countriesId: 1,
        phoneNumber : "01011112222"
      }),
    ).rejects.toThrow("DUPLICATED_EMAIL");
  });

  test("respond 404, when the nickname is empty", async () => {
    await expect(
      service.signUp({
        email: "email@email.com",
        password: "1234",
        nickname: "",
        username: "junoLee",
        confirmedPassword: "1234",
        countriesId: 1,
        phoneNumber : "01011112222"
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
        username: "junoLee",
        confirmedPassword: "1234",
        countriesId: 1,
        phoneNumber : "01011112222"
      }),
    ).rejects.toThrow("DUPLICATED_NICKNAME");
  });

  test("respond 404, when the password is empty", async () => {
    MockRepo.isEmailDuplicated.mockResolvedValue(false);
    MockRepo.isNicknameDuplicated.mockResolvedValue(false);

    await expect(
      service.signUp({
        email: "email@email.com",
        password: "",
        nickname: "j",
        username: "junoLee",
        confirmedPassword: "1234",
        countriesId: 1,
        phoneNumber : "01011112222"
      }),
    ).rejects.toThrow("INVALID_PASSWORD");
  });
  test("response  Unmatched Pwd, if confirmed password", async () => {
    await expect(
      service.signUp({
        email: "email1@email.com",
        password: "1234",
        confirmedPassword: "12345",
        nickname: "Juno",
        countriesId: 1,
        username: "junoLee",
        phoneNumber : "01011112222"
      }),
    ).rejects.toThrow("PASSWORD_NOT_MATCH");
  });
  test("성공적으로 휴대폰 번호가 암호화 되는지 확인", async() =>{
      const mockEncrypt = jest.spyOn(crypto, "encrypt").mockReturnValue({
        encrypted: "mocked",
        iv: "mocked-iv",
    })
    await service.signUp({
        email: "email1@email.com",
        password: "1234",
        confirmedPassword: "1234",
        nickname: "Juno",
        countriesId: 1,
        username: "junoLee",
        phoneNumber: "01012345678",
  })
   expect(mockEncrypt).toHaveBeenCalledWith("01012345678");
  })
  //test(" 암호화된 유저의 휴대폰 번호가 이미 등록된 휴대폰 인경우, 에러 던지기", async() =>{})
  test("로그인 성공시 사용자 정보리턴", async () => {
    MockRepo.isEmailDuplicated.mockResolvedValue(false);
    MockRepo.isNicknameDuplicated.mockResolvedValue(false);
    const fakeUser = {
      id: 1,
      email: "email1@email.com",
      password: "12345",
      confirmedPassword: "12345",
      nickname: "Juno",
      countriesId: 1,
      username: "junoLee",
      phoneNumber: "01012345678",
    };

    MockRepo.createAdmin.mockResolvedValue(fakeUser);
    const result = await service.signUp(fakeUser);

    expect(result).toBe(fakeUser);
  });
});
//===================================================================================

describe("인증 로직 테스트 - login service", () => {
  test("EMAIL이 DB에 없는 경우 NOT FOUND 에러 던지기", async () => {
    MockRepo.findByEmail.mockResolvedValue(null);
    await expect(
      service.login({
        email: "test@example.com",
        password: "1233",
      }),
    ).rejects.toThrow("INVALID USER EMAIL");
  });
  test("비밀번호 암호화 성공 테스트", async () => {
    const spy = jest
      .spyOn(hash, "hashedPassword")
      .mockResolvedValue("fake-hash");
    const result = await hash.hashedPassword("1234");

    expect(result).toBe("fake-hash");
    expect(spy).toHaveBeenCalled();
  });
  test("해싱화된 비밀번호가 DB에 있는 비밀번호와 다른 경우, 401에러 던지기", async () => {
    const fakeUser = {
      email: "test@example.com",
      password: "1234",
    };

    MockRepo.findByEmail.mockResolvedValue(fakeUser.email);
    jest.spyOn(hash, "match").mockResolvedValue(false);
    await expect(
      service.login({
        email: "test@example.com",
        password: "12345",
      }),
    ).rejects.toThrow("Wrong Password");
  });
  test("액세스 토큰이 생성이 되었다면 액세스토큰 토큰값들 리턴", async () => {
    jest.spyOn(hash, "match").mockResolvedValue(true);
    const fakeUser = {
      id: 1,
      email: "test@example.com",
      password: "12345",
    };
    MockRepo.findByEmail.mockResolvedValue(fakeUser);
    jest.spyOn(token, "generateToken").mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });

    const result = await service.login({
      email: fakeUser.email,
      password: fakeUser.password,
    });

    expect(result).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
  });
});

//======================================================================================
describe("인증 로직 테스트 - 관리자 정보 찾기", () => {
  test("해당 관리자가 존재하지 않는 경우 404", async () => {
    MockRepo.findAdvisorById.mockResolvedValue(null);
    await expect(service.findAdvisorById(1)).rejects.toThrow("NOT FOUND");
  });
  test("관리자가 존재 하는 경우 해당 유저 리턴", async () => {
    MockRepo.findAdvisorById.mockResolvedValue({
      id: 1,
      username: "juno",
      team: "Machester Busan United",
    });
    const result = await service.findAdvisorById(1);
    expect(MockRepo.findAdvisorById).toHaveBeenCalledWith(1);
    expect(result).toEqual({
      id: 1,
      username: "juno",
      team: "Machester Busan United",
    });
  });
});

//======================================================================================
describe("인증 로직 테스트 - 관리자들 찾기", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test("관리자 이름으로 조회 했을때 없는 경우, []", async () => {
    MockRepo.findAdvisors.mockResolvedValue([]); // 예상 되는 결과값

    const result = await service.findAdvisors(
      { page: 1, take: 10 },
      { teamname: undefined, username: "junoK" },
    );
    expect(MockRepo.findAdvisors).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  test("팀으로 관리자 목록을 조회 했을 때 없는 경우, []", async () => {
    MockRepo.findAdvisors.mockResolvedValue([]); // 예상 되는 결과값

    const result = await service.findAdvisors(
      { page: 1, take: 10 },
      { username: undefined, teamname: "JunoFc" },
    );
    expect(MockRepo.findAdvisors).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  test("팀, 관리자 이름으로 조회했을 때 없는 경우, []", async () => {
    MockRepo.findAdvisors.mockResolvedValue([]); // 예상 되는 결과값

    const result = await service.findAdvisors(
      { page: 1, take: 10 },
      {
        username: "junoK",
        teamname: "JunoFc",
      },
    );
    expect(MockRepo.findAdvisors).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  test("관리자 이름으로 조회 했을때 여러개의 데이터를 배열로 리턴", async () => {
    const data = [
      { username: "juno", teamname: "Manchester Ulsan FC" },
      { username: "juno", teamname: "Chelsea Pusan FC" },
    ];
    MockRepo.findAdvisors.mockResolvedValue(data);
    const result = await service.findAdvisors(
      { page: 1, take: 10 },
      {
        teamname: undefined,
        username: "juno",
      },
    );
    expect(MockRepo.findAdvisors).toHaveBeenCalled();
    expect(result).toEqual(data);
  });

  test("팀으로 관리자 목록을 조회 했을 때 여러개의 데이터를 배열로 리턴", async () => {
    const data = [
      { username: "juno", teamname: "Manchester Ulsan FC" },
      { username: "jenny", teamname: "Manchester Ulsan FC" },
    ];
    MockRepo.findAdvisors.mockResolvedValue(data);
    const result = await service.findAdvisors(
      { page: 1, take: 10 },
      {
        username: undefined,
        teamname: "Manchester Ulsan FC",
      },
    );
    expect(MockRepo.findAdvisors).toHaveBeenCalled();
    expect(MockRepo.findAdvisors).toHaveBeenCalledWith({
      where: {
        teamname: "Manchester Ulsan FC",
      },
      page: 1,
      take: 10,
    });
    expect(result).toEqual(data);
  });

  test("팀과 관리자 이름으로 조회했을 때 리스트가 있는 경우, 여러개의 데이터 배열로 리턴 ", async () => {
    const data = [
      //TODO: 암호화된 휴대폰 번호 결과 값에 넣어야됨
      { username: "chloe", teamname: "Chelsea Pusan FC" },
      { username: "chloe", teamname: "Chelsea Pusan FC" },
      { username: "chloe", teamname: "Chelsea Pusan FC" },
    ];
    MockRepo.findAdvisors.mockResolvedValue(data);
    const result = await service.findAdvisors(
      {
        page: 1,
        take: 10,
      },
      {
        username: "chloe",
        teamname: "Chelsea Pusan FC",
      },
    );
    expect(MockRepo.findAdvisors).toHaveBeenCalled();
    expect(MockRepo.findAdvisors).toHaveBeenCalledWith({
      where: {
        username: "chloe",
        teamname: "Chelsea Pusan FC",
      },
      page: 1,
      take: 10,
    });
    expect(result).toEqual(data);
  });
});

//======================================================================================
describe("인증 로직 테스트 - 단일 관리자 정보 수정", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test("해당 관리자가 없는 경우 404 던지기", async () => {
    //GIVEN
    const input = {
      id: 2,
      teamname: "juno Fc",
      username: "juno",
      email: "email@test.com",
      password: "1234",
      role: Role.ADMIN,
      country: "",
    };
    MockRepo.findAdvisorById.mockResolvedValue(null);
    MockRepo.updatesAdvisor.mockResolvedValue(null);
    //WHEN + THEN
    await expect(service.updatesAdvisor(input)).rejects.toThrow("NOT FOUND");
  });
  //test("해당 관리자의 비밀번호 변경시 현재 비밀번호와 같은 경우 400 에러 던지기")
  test("해당 관리자 정보 변경 성공시 해당 유저 정보 반환", async () => {
    //  GIVEN
    const input: IAuth = {
      id: 2,
      username: "JunKi",
      teamname: "MK DONS",
      password: "hashed",
      email: "example@test.com",
      role: Role.ADMIN,
      country: "SOUTH KOREA",
    };
    const updatedInput: IAuth = {
      id: 2,
      username: "JunKi",
      teamname: "MK DONS FC",
      password: "hashed",
      email: "example@test.com",
      role: Role.ADMIN,
      country: "SOUTH KOREA",
    };
    //
    MockRepo.findAdvisorById.mockResolvedValue({
      username: "JunKi",
      teamname: "MK DONS",
      password: "hashed",
    });
    MockRepo.updatesAdvisor.mockResolvedValue(updatedInput);
    //  WHEN
    const result = await service.updatesAdvisor(input);
    //  THEN
    expect(MockRepo.findAdvisorById).toHaveBeenCalled();
    expect(MockRepo.updatesAdvisor).toHaveBeenCalledWith(input);
    expect(result).toEqual(updatedInput);
  });
});

//======================================================================================
describe("인증로직 테스트 - 다수 관리자 상태 정보 수정", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test("해당 관리자들이 존재 하지 않는 경우 유효 하지않는 관리자 에러 던지기", async () => {
    // GIVEN
    const data: any = []; //DB 에서 가지고온 가짜데이터
    const inputData = [
      {
        id: 1,
        status: Status.INACTIVE,
      },
    ];
    MockRepo.findAdvisorsByIds.mockResolvedValue(data);
    //WHERE + THEN
    await expect(service.updateAdvisorsStatus(inputData)).rejects.toThrow(
      "Invalid adminstrators",
    );
  });
  test("filter후 데이터 반환 체크", async () => {
    // GIVEN
    const data = [
      //DB
      {
        id: 1,
        status: "ACTIVE",
      },
      {
        id: 2,
        status: "ACTIVE",
      },
    ];
    const inputData = [
      // 클라이언트 요청
      {
        id: 1,
        status: Status.INACTIVE,
      },
      {
        id: 2,
        status: Status.INACTIVE,
      },
    ];
    MockRepo.findAdvisorsByIds.mockResolvedValue(data);
    MockRepo.updateAdvisorsStatus.mockResolvedValue(inputData);
    //WHEN
    const result = await service.updateAdvisorsStatus(inputData);

    //THEN
    expect(result).toEqual(inputData);
  });
});

//======================================================================================
describe("인증 로직 테스트 - 회원 삭제", () => {
  beforeEach(() => jest.clearAllMocks());
  test("해당 관리자가 존재 하지 않는 경우 NOT FOUND 에러 던지기 테스트", async () => {
    // GIVEN
    const fake = {
      id: 1,
    };
    MockRepo.findAdvisorById.mockResolvedValue(null);
    // WHEN + THEN
    await expect(service.delete(fake.id)).rejects.toThrow("NOT FOUND");
  });
  test("삭제한 관리자의 삭제 isDeleted가 true라면 DB까지 삭제", async () => {
    const fake = {
      id: 1,
      username: "juno",
      isDeleted: true,
    };
    MockRepo.findAdvisorById.mockResolvedValue(fake);

    MockRepo.delete.mockResolvedValue(undefined);

    const result = await service.delete(fake.id);

    expect(MockRepo.findAdvisorById).toHaveBeenCalledWith(fake.id);

    expect(result).toEqual(undefined);
  });
  test("삭제시 isDeleted가 false라면 soft Delete 수행", async () => {
    const fake = {
      id: 1,
      username: "jk",
      isDeleted: false,
    };
    MockRepo.findAdvisorById.mockResolvedValue(fake);
    MockRepo.updatesAdvisor.mockResolvedValue({ id: fake.id, isDeleted: true });
    await service.delete(fake.id);
    expect(MockRepo.findAdvisorById).toHaveBeenCalledWith(fake.id);
    expect(MockRepo.updatesAdvisor).toHaveBeenCalledWith({
      id: fake.id,
      isDeleted: true,
    });
  });
});

//======================================================================================

describe("인증 로직 테스트 - 다수 회원 삭제", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test("해당 삭제할 유저들이 DB에 존재 하지 않는다면 NOT FOUND 에러 메시지 확인", async () => {
    const DATA = [
      {
        id: 1,
        role: "ADMIN",
        username: "juno",
        isDeleted: false,
        status: Status.INACTIVE,
      },
      {
        id: 2,
        role: "ADMIN",
        username: "jk",
        isDeleted: false,
        status: Status.INACTIVE,
      },
    ];
    MockRepo.findAdvisorsByIds.mockResolvedValue([]);
    await expect(service.deleteMany(DATA)).rejects.toThrow("NOT FOUND");
  });
  test("filter 후 isDeleted  false시, true로 변경", async () => {
    const requestData = [
      { id: 2, isDeleted: true },
      { id: 3, isDeleted: true },
    ];
    const userDB = [
      {
        id: 2,
        role: "ADMIN",
        username: "jk",
        isDeleted: false,
      },
      {
        id: 3,
        role: "ADMIN",
        username: "jik",
        isDeleted: false,
      },
    ];
    MockRepo.findAdvisorsByIds.mockResolvedValue(userDB);
    MockRepo.updateAdvisorsStatus.mockResolvedValue(requestData);

    const result = await service.deleteMany(requestData);

    expect(MockRepo.updateAdvisorsStatus).toHaveBeenCalledWith({
      ids: [2, 3],
      isDeleted: true,
    });
  });
});
