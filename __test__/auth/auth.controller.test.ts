import { describe, test, jest, expect } from "@jest/globals";
import { Request, Response } from 'express';
import AuthController  from "../../src/auth/auth.controller";
const authService = {
  login: jest.fn(),
  logout: jest.fn(),
  signUp: jest.fn(),
  findAdvisorById: jest.fn(),
  findAdvisors: jest.fn(),
  updatesAdvisor: jest.fn(),
  updateAdvisorsStatus: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
} as any; // 임시

const controller = new AuthController(authService);

describe("인증 컨트롤러 테스트 - registry service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
  jest.restoreAllMocks();
});
  test("respond 201 when registry success", async () => {
    const req = { body: { email: "test@test.com" } } as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await controller.signUp(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(authService.signUp).toHaveBeenCalled();
  });
  test("respond 500 when registry fail", async () => {
    const req = { body: { email: "test@test.com" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    authService.signUp.mockRejectedValue(new Error("SERVER INTERNAL ERROR"));

    await controller.signUp(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "SERVER INTERNAL ERROR",
    });
  });
});
//=========================================================================

describe("인증 컨트롤러 테스트 - login controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
  jest.restoreAllMocks();
});
  test("로그인에 성공한 경우, 200 상태코드 던지기", async () => {
    const req = { body: { email: "test@test.com", password: "12345567" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    authService.login.mockResolvedValue({ email: "test@test.com" });
    await controller.login(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ email: "test@test.com" });
  });
  test("로그인에 실패한 경우, 500에러와 '알수없는 에러' 메시지 던지기", async () => {
    const req = { body: { email: "test@test.com", password: "12345567" } } as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    authService.login.mockRejectedValue(new Error("SERVER INTERNAL ERROR"));
    await controller.login(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "SERVER INTERNAL ERROR",
    });
  });
});

//======================================================================================
describe("인증 컨트롤러 테스트 - 관리자 조회", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test("인증 안된 유저 인경우 401과 UNAUTHORIZED 던지기", async () => {
    const req = {
      user:null,
      params:{
        id:"1"
      }
    } as unknown as Request
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }as unknown as Response;
    await controller.findAdvisorById(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "UNAUTHORIZED" });
  });

  test("조회할 권한이 없는 경우 403과 FORBIDDEN 던지기", async () => {
    const req = {
      user: {
        id:1,
        role: "ADMIN",
      },
    }as unknown as Request
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }as unknown as Response
    authService.findAdvisorById.mockResolvedValue();
    await controller.findAdvisorById(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "FORBIDDEN" });
  });

  test("알 수 없는 에러인 경우 500에러 와 에러 메시지 던지기", async () => {
    const req = {
      user: {
        id: 1,
        role: "SUPER_ADMIN",
      },
    }as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }as unknown as Response;
    authService.findAdvisorById.mockRejectedValue(
      new Error("SERVER INTERNAL ERROR"),
    );
    await controller.findAdvisorById(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "SERVER INTERNAL ERROR",
    });
  });

  test("해당 회원이 성공적으로 조회 했다면 200 상태 메시지와 해당 함수가 올바르게 실행되는지 확인", async () => {
    const req = {
      user: {
        id: 1,
        role: "SUPER_ADMIN",
      },
      params:{
        id: "1"
      }
    }as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }as unknown as Response;

    authService.findAdvisorById.mockResolvedValue({
      id: 1,
      role: "SUPER_ADMIN",
    });

    await controller.findAdvisorById(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
  });
});

//======================================================================================
describe("인증 컨트롤러 테스트 - 관리자들 조회", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test("인증되지 않는 유저인경우 401, UNAUTHORIZED 던지기", async () => {
    const req = {
      user: {
        id:null
      },
      query: { take: 10, limit: 0 },
    }as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    await controller.findAdvisors(req, res );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "UNAUTHORIZED",
    });
  });

  test("조회할 권한이 없다면 403, FORBIDDEN", async () => {
    const req = {
      user: {
        id: 1,
        role: "ADMIN",
      },
      query: { take: 10, limit: 0 },
    }as unknown as Request
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }as unknown as Response
    await controller.findAdvisors(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "FORBIDDEN",
    });
  });

  test("해당 서비스 로직이 호출이 된다면 200", async () => {
    const req = {
      user: {
        id: 1,
        role: "SUPER_ADMIN",
      },
      query: { take: 10, skip: 0 },
    }as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }as unknown as Response;
    authService.findAdvisors({
      user: {
        id: 1,
        role: "SUPER_ADMIN",
      },
      query: { take: 10, skip: 0 },
    });
    await controller.findAdvisors(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
  });
  test("알수없는 에러 인 경우, 500 과 SERVER INTERNAL ERROR", async () => {
    const req = {
      user: {
        id: 1,
        role: "SUPER_ADMIN",
      },
      query: { take: 10, limit: 0 },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    authService.findAdvisors.mockRejectedValue(
      new Error("SERVER INTERNAL ERROR"),
    ); // 예상 결과값
    await controller.findAdvisors(req as any, res as any); //해당 함수 호출
    expect(res.status).toHaveBeenCalledWith(500); // 결과 값 비교
    expect(res.json).toHaveBeenCalledWith({
      message: "SERVER INTERNAL ERROR",
    });
  });
});
//======================================================================================
describe("인증 컨트롤러 테스트 - 단일 관리자 정보 수정", () => {
  // 로그인 되어있지 않는 경우 401
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test("인증 되지 않는 유저 인경우 401 에러 코드 및, 에러 메시지 동일 확인", async () => {
    const req = {
      user: {
        id: null,
      },
    }as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }as unknown as Response;
    await controller.updatesAdvisor(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "UNAUTHORIZED",
    });
  });
  // 알 수 없는 에러인경우 500
  test("서버 내부 오류 인경우 500 ", async () => {
    const req = {
      user: {
        id: 1,
        role: "SUPER_ADMIN",
      },
      body: {
        username: "juno",
        teamname: "mate fc",
      },
    }as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }as unknown as Response;
    authService.updatesAdvisor.mockRejectedValue("SERVER INTERNAL ERROR");
    await controller.updatesAdvisor(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "SERVER INTERNAL ERROR",
    });
  });
  // 성공적으로 서비스 로직 값이 호출된 경우 200
  test("성공적으로 서비스 로직 값이 호출된 경우 200 와 성공메시지 던지기", async () => {
    const req = {
      user: {
        id: 1,
        username: "juno",
        teamname: "mate fc",
      },
      body: {
        id: 1,
        username: "juno",
        teamname: "mate fc",
      },
    }as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }as unknown as Response;
    authService.updatesAdvisor.mockResolvedValue({
      id: 1,
      username: "juno",
      teamname: "mate fc",
    });
    await controller.updatesAdvisor(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "successfully modified information",
    });
  });
});
//======================================================================================

describe("인증 컨트롤러 테스트 - 다수의 관리자 정보 수정", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test("인증 되지 않는 유저 인경우 401 에러 및, UNAUTHORIZED 던지기", async () => {
    const req = {
      user: {
        id: null,
      },
    }as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }as unknown as Response;
    await controller.updateAdvisorsStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "UNAUTHORISED",
    });
  });

  test("해당 유저의 권한이 없는 경우 403과 forbidden에러 메시지 던지기", async () => {
    const req = {
      user: {
        id: 1,
        role: "ADMIN",
      },
    }as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }as unknown as Response;
    await controller.updateAdvisorsStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "FORBIDDEN",
    });
  });

  test("알 수 없는 에러 발생시 500와 에러메시지 던지기", async () => {
    const req = {
      user: {
        id: 1,
        username: "junk",
        role: "SUPER_ADMIN",
      },
      body: {
        status: "Inactive",
      },
      query: {
        take: 10,
        limit: 1,
      },
    }as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }as unknown as Response;
    authService.updateAdvisorsStatus.mockRejectedValue(
      new Error("SERVER INTERNAL ERROR"),
    );

    await controller.updateAdvisorsStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "SERVER INTERNAL ERROR",
    });
  });
  test("성공적으로 함수 호출시 200 상태 코드와 메세지 던지기", async () => {
    const req = {
      user: {
        id: 1,
        username: "hun",
        role: "SUPER_ADMIN",
      },
      body: [{ id: 1, status: "INACTIVE" }],

      query: {
        take: 10,
        limit: 1,
      },
    }as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }as unknown as Response;
    authService.updateAdvisorsStatus.mockResolvedValue([
      { id: 1, status: "INACTIVE" },
    ]);
    await controller.updateAdvisorsStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "상태 변경 완료" });
  });
});

//======================================================================================
describe("인증 컨트롤러 테스트 - 단일 관리자 삭제", () => {
  test("로그인되어있지않는 유저 인경우 401", async () => {
    const req = {
      user: {
        id: null,
      },
    }as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }as unknown as Response;

    await controller.delete(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "UNAUTHORISED",
    });
  });

  test("권한이 없는 경우 403", async () => {
    const req = {
      user: {
        id: 1,
        role: "ADMIN",
      },
      params: {
        id: 1,
      },
    }as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }as unknown as Response;
    await controller.delete(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "FORBIDDEN",
    });
  });

  test("삭제 성공할 경우 204", async () => {
    const req = {
      user: {
        id: 1,
        role: "SUPER_ADMIN",
      },
      params: {
        id: 1,
      },
      body: {
        isDeleted: false,
      },
    }as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    }as unknown as Response;

    authService.delete.mockResolvedValue(true);

    await controller.delete(req, res);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
  test("알 수없는 에러 인경우 500", async () => {
    const req = {
      user: {
        id: 1,
        role: "SUPER_ADMIN",
      },
      body: {
        isDeleted: false,
      },
    }as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }as unknown as Response;
    authService.delete.mockRejectedValue(new Error("SERVER INTERNAL ERROR"));
    await controller.delete(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "SERVER INTERNAL ERROR",
    });
  });
});
//======================================================================================
describe("인증 컨트롤러 테스트 - 다수 관리자 삭제", () => {
  test("인증 오류시 401 및 UNAUTHORIZED 반환 확인", async () => {
    const req = {
      user: {
        id: null,
      },
    }as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }as unknown as Response;
    await controller.deleteMany(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "UNAUTHORIZED",
    });
  });
  test("권한 오류시 403 및 FORBIDDEN 반환 확인", async () => {
    const req = {
      user: {
        id: 1,
        role: "ADMIN",
      },
    }as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }as unknown as Response;
    await controller.deleteMany(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "FORBIDDEN",
    });
  });
  test("서버에 문제 발생시 500와 에러메시지 반환 확인", async () => {
    const req = {
      user: {
        id: 1,
        role: "SUPER_ADMIN",
      },
    }as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }as unknown as Response;
    authService.deleteMany.mockRejectedValue(
      new Error("SERVER INTERNAL ERROR"),
    );

    await controller.deleteMany(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "SERVER INTERNAL ERROR",
    });
  });
  test("삭제 성공시 204와 삭제 성공 메시지 확인", async () => {
    const req = {
      user: {
        id: 1,
        role: "SUPER_ADMIN",
      },
      body: {
        isDeleted: false,
      },
    }as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    }as unknown as Response;
    authService.deleteMany.mockResolvedValue(true);

    await controller.deleteMany(req, res);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
  });
});
