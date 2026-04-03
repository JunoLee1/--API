import { generateToken, verifyAccessToken, verifyRefreshToken} from "../../src/lib/token"

describe("토큰 테스트", ()=>{
    test("인증된 토큰이 생성 되었다면, 인증된 토큰값들 리턴", async () => {
       const result = await generateToken(1)
        expect(result.accessToken).toBeDefined()
        expect(result.refreshToken).toBeDefined()
    })
   

    test("verify accessToken 유저 id 읽기", async() => {
        const { accessToken } = await generateToken(1)
        const decoded = await verifyAccessToken(accessToken)
        console.log(decoded)
        expect(decoded.sub).toBe(1)
    })

    test("verify refreshToken 유저 id 읽기", async() => {
        const { refreshToken } = await generateToken(1)
        const decoded = await verifyRefreshToken(refreshToken)
        console.log(decoded)
        expect(decoded.sub).toBe(1)
    })
})