import { AuthRepository } from "./auth.repo";
import { AppError } from "../lib/appError";
import { hashPassword, comparePassword } from "../lib/hash";
import { encrypt } from "../lib/crypto";
import { generateTokens } from "../lib/token";
import { LoginDto, CreateUserDto } from "./dto/auth.dto";

export class AuthService {
  constructor(private repo: AuthRepository) {}

  async login({ email, password }: LoginDto) {
    const user = await this.repo.findByEmail(email);
    if (!user) throw new AppError(401, "INVALID_CREDENTIALS");

    const valid = await comparePassword(password, user.password);
    if (!valid) throw new AppError(401, "INVALID_CREDENTIALS");

    return generateTokens(user.id, user.role);
  }

  async createUser(dto: CreateUserDto) {
    if (dto.password !== dto.confirmedPassword) throw new AppError(400, "PASSWORD_MISMATCH");

    if (await this.repo.isEmailTaken(dto.email)) throw new AppError(409, "EMAIL_TAKEN");
    if (await this.repo.isNicknameTaken(dto.nickname)) throw new AppError(409, "NICKNAME_TAKEN");

    const password = await hashPassword(dto.password);
    const phoneNumber = encrypt(dto.phoneNumber);

    return this.repo.createUser({
      email: dto.email,
      password,
      username: dto.username,
      nickname: dto.nickname,
      role: dto.role,
      dateOfBirth: new Date(dto.dateOfBirth),
      nationalityId: dto.nationalityId,
      phoneNumber,
    });
  }

  async me(id: number) {
    const user = await this.repo.findById(id);
    if (!user) throw new AppError(404, "USER_NOT_FOUND");
    return user;
  }
}
