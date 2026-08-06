import { AppError } from "../lib/appError"
import { Request, Response,NextFunction} from "express"

export const errorHandler = (err:Error, req:Request, res:Response, next:NextFunction) => {
    if(err instanceof AppError){
        return res.status(err.statusCode).json({
            message:err.code
        })
    }
    console.error(err)
    const detail = err instanceof Error ? err.message : (err != null ? String(err) : 'unknown')
    return res.status(500).json({
        code: "INTERNAL_SERVER_ERROR",
        detail,
    })
}