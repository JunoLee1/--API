import { Role } from "../../src/generated/enums"
import { generateToken} from "../../src/lib/token"

describe("토큰 테스트", ()=>{
    test("인증된 토큰이 생성 되었다면, 인증된 토큰값들 리턴", async () => {
       const result = await generateToken(1,Role.ADMIN)
        expect(result.accessToken).toBeDefined()
        expect(result.refreshToken).toBeDefined()
    })
   
})