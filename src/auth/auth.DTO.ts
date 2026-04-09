export type LoginInput = {
    email:string,
    password: string
}
export type Pagenation = {
    take:number,
    page: number
}
export type NameType = {
    username:string | undefined,
    teamname:string | undefined
}
export type InputData = {
    id:number,
}
enum Role {
    ADMIN,
    SUPER_ADMIN
}
export interface IUser {
    id: number, // should change to string
    username: string
    teamname: string,
    email:string,
    password: string,
    //phoneNumber:string
    role:Role.ADMIN
    country: String
}
export type LoginOutput = {
    accessToken:string,
    refreshToken:string
}