import * as bcrypt from "bcrypt";

export const hashedPassword = async(password:string):Promise<string> => {
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    return await bcrypt.hash(password, salt)
}
export const match = async (password:string, inputPassword:string) => {
    return bcrypt.compare(inputPassword, password);
}