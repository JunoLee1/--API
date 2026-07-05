import { AppError } from "../lib/appError"
import { Request, Response,NextFunction} from "express"

export const errorHandler = (err:Error, req:Request, res:Response, next:NextFunction) => {
    if(err instanceof AppError){
        return res.status(err.status).json({
            message:err.message
        })
    }
    return res.status(500).json({
        message:"INTERNAL SERVER ERROR"
    })
}