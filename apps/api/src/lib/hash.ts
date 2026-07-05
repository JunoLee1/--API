import bcrypt from "bcrypt";

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, 10);

export const comparePassword = (plain: string, hashed: string): Promise<boolean> =>
  bcrypt.compare(plain, hashed);
