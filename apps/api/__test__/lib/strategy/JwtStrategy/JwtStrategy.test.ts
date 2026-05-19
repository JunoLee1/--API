import { Role } from "../../../../src/generated/enums"
import { jwtVerify } from "../../../../src/lib/strategy/JwtStrategy/jwtStrategy"


describe("jwt verify function",() => {
    test("if it works, send payload down", async() => {
        const done =jest.fn()
        await jwtVerify({sub:1, role:Role.ADMIN }as any, done)
        expect(done).toHaveBeenCalledWith(null,{id:1, role:Role.ADMIN})
    })
})


