import { describe, test, jest, expect } from "@jest/globals";
import AuthController from "../../src/auth/auth.controller";
const authService = {
  login: jest.fn(),
  logout: jest.fn(),
  signUp: jest.fn(),
  findAdvisorById: jest.fn(),
  findAdvisors: jest.fn(),
  updatesAdvisor: jest.fn()
} as any; // 임시

const controller = new AuthController(authService);
describe("인증 컨트롤러 테스트 - registry service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test("respond 201 when registry success", async () => {
    const req = { body: { email: "test@test.com" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.signUp(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(authService.signUp).toHaveBeenCalled();
  });
  test("respond 400 when registry fail", async () => {
    const req = { body: { email: "test@test.com" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    authService.signUp.mockRejectedValue(new Error("Something Wrong"));

    await controller.signUp(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Something Wrong",
    });
  });
});
//=========================================================================

describe("인증 컨트롤러 테스트 - login controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    const req = { body: { email: "test@test.com", password: "12345567" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    authService.login.mockRejectedValue(new Error("Something Wrong"));
    await controller.login(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Something Wrong",
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
      user: null,
      params: { id: 1 },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    await controller.findAdvisorById(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "UNAUTHORIZED" });
  });

  test("조회할 권한이 없는 경우 403과 FORBIDDEN 던지기", async () => {
    const req = {
      user: { role: "SUPER_ADMIN" },
      params: { id: 1 },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    authService.findAdvisorById.mockResolvedValue({
      id: 1,
      role: "ADMIN",
    });
    await controller.findAdvisorById(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith("FORBIDDEN");
  });

  test("알 수 없는 에러인 경우 500에러 와 에러 메시지 던지기", async () => {
    const req = { 
      user:{
        role: "SUPER_ADMIN"
      },
      params: { id: 1 }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    authService.findAdvisorById.mockRejectedValue(new Error("Something Wrong"));
    await controller.findAdvisorById(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Something Wrong",
    });
  });

  test("해당 회원이 성공적으로 조회 했다면 200 상태 메시지와 해당 함수가 올바르게 실행되는지 확인", async () => {
    const req = {
      user: { role: "SUPER_ADMIN" },
      params: { id: 1 },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    authService.findAdvisorById.mockResolvedValue({
      id: 1,
      role: "SUPER_ADMIN",
    });

    await controller.findAdvisorById(req as any, res as any);
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
      user: null,
      query:{take:10, limit: 0}
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    await controller.findAdvisors(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "UNAUTHORIZED",
    });
  });
  
  test("조회할 권한이 없다면 403, FORBIDDEN", async () => {
    const req = {
      user: { role: "ADMIN" },
      query: { take: 10, limit: 0 },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    await controller.findAdvisors(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "FORBIDDEN",
    });
  });
  
  test("해당 서비스 로직이 호출이 된다면 200", async () => {
    const req = {
      user:{role:"SUPER_ADMIN"},
      query: { take: 10, skip: 0 },
    };
    const res  = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    authService.findAdvisors({
      user:{role:"SUPER_ADMIN"},
      query: { take: 10, skip: 0 },
    })
    await controller.findAdvisors(req as any, res as any)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalled()
  });
  test("알수없는 에러 인 경우, 500 과 Something Wrong", async () => {
    const req = {
      user:{role:"SUPER_ADMIN"},
      query: { take: 10, limit: 0 },
    }
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
   
    authService.findAdvisors.mockRejectedValue(new Error("Something Wrong"))// 예상 결과값
    await controller.findAdvisors(req as any, res as any)//해당 함수 호출
    expect(res.status).toHaveBeenCalledWith(500)// 결과 값 비교
    expect(res.json).toHaveBeenCalledWith({
      message:"Something Wrong"
    })
  });
});
//======================================================================================
describe("인증 컨트롤러 테스트 - 단일 관리자 정보 수정", () => {
  
  // 로그인 되어있지 않는 경우 401
  test("인증 되지 않는 유저 인경우 401 에러 코드 및, 에러 메시지 동일 확인", async() =>{
    const req = {
      user:{
        id : null
      }
    }
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    }
    await controller.updatesAdvisor(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      message: "UNAUTHORIZED"
    })
  })

  /*
  // 알 수 없는 에러인경우 500
  test("", async() =>{})
*/
  // 성공적으로 서비스 로직 값이 호출된 경우 200
  test("성공적으로 서비스 로직 값이 호출된 경우 200 와 성공메시지 던지기", async() =>{
    const req = {
      user:{
        id:1,
        username:"juno",
        teamname:"mate fc"
      },
      body:{
        username:"juno",
        teamname:"mate fc"
      }
    }
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    }
    console.log(1)
    authService.updatesAdvisor.mockResolvedValue({
      username:"juno",
      teamname:"mate fc"
    })
    console.log(12)
    await controller.updatesAdvisor(req, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      message:"successfully modified information"
    })
  }) 
})
//======================================================================================
/*
describe("인증 컨트롤러 테스트 - 다수의 관리자 정보 수정")
//======================================================================================
describe("인증 컨트롤러 테스트 - 단일 관리자 삭제")
//======================================================================================
describe("인증 컨트롤러 테스트 - 다수 관리자 삭제")
*/