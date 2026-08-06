import { AppError } from "../lib/appError"
import { Request, Response,NextFunction} from "express"

export const errorHandler = (err:Error, req:Request, res:Response, next:NextFunction) => {
    if(err instanceof AppError){
        return res.status(err.statusCode).json({
            message:err.code
        })
    }
    console.error(err)
    return res.status(500).json({
        message:"INTERNAL SERVER ERROR"
    })
}