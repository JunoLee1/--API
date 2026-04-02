import passport = require("passport")
import {accessTokenStrategy,refreshTokenStrategy} from "./jwtStrategy"
import authService from "../../../auth/auth.service"

const service = new authService()
passport.use('access-token', accessTokenStrategy)
passport.use('refresh-token', refreshTokenStrategy)

passport.serializeUser (function (userId,done){
    done(null, userId)
})
passport.deserializeUser(async function(id, done){
    const user = await service.findAdvisorById(id)
    done(null, user)
})
export default passport