import { jwtVerify } from "../../../../src/lib/strategy/JwtStrategy/jwtStrategy"


describe("jwt verify function",() => {
    test("if it works, send payload down", async() => {
        const done =jest.fn()
        await jwtVerify({sub:1}as any, done)
        expect(done).toHaveBeenCalledWith(null,{sub:1})
    })
})


