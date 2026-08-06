import { AuthRepository } from "./auth.repo";
import { AppError } from "../lib/appError";
import { hashPassword, comparePassword } from "../lib/hash";
import { encrypt } from "../lib/crypto";
import { generateTokens } from "../lib/token";
import { LoginDto, CreateUserDto } from "../lib/dto";
import { Role, CoachingRole, FrontOfficeRole } from "../generated/enums";

export class AuthService {
  constructor(private repo: AuthRepository) {}

  async login({ email, password }: LoginDto) {
    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      throw new AppError(401, "INVALID_CREDENTIALS");
    }
    const user = await this.repo.findByEmail(email);
    if (!user) throw new AppError(401, "INVALID_CREDENTIALS");

    const valid = await comparePassword(password, user.password);
    if (!valid) throw new AppError(401, "INVALID_CREDENTIALS");

    const tokens = generateTokens({ id: user.id, role: user.role, coachingRole: user.coachingRole, frontOfficeRole: user.frontOfficeRole, teamId: user.teamId, clubId: user.clubId, isDemo: user.isDemo });
    return { ...tokens, userId: user.id };
  }

  async createUser(dto: CreateUserDto) {
    if (dto.password !== dto.confirmedPassword) throw new AppError(400, "PASSWORD_MISMATCH");

    // 010-1234-5678 형식
    if (!/^\d{2,3}-\d{3,4}-\d{4}$/.test(dto.phoneNumber)) throw new AppError(400, "INVALID_PHONE_NUMBER");

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
      coachingRole: dto.coachingRole ?? null,
      frontOfficeRole: dto.frontOfficeRole ?? null,
      dateOfBirth: new Date(dto.dateOfBirth),
      nationalityId: dto.nationalityId,
      phoneNumber,
    });
  }

  async createInvite(dto: { email: string; role: Role; coachingRole?: CoachingRole | null; frontOfficeRole?: FrontOfficeRole | null; createdById: number }) {
    if (await this.repo.isEmailTaken(dto.email)) throw new AppError(409, "EMAIL_TAKEN");
    const invite = await this.repo.createInvite(dto);
    const appUrl = process.env["APP_URL"] ?? "http://localhost:5173";
    const inviteUrl = `${appUrl}/invite/${invite.token}`;
    const { sendInviteEmail } = await import("../lib/email");
    await sendInviteEmail(dto.email, inviteUrl, dto.role);
    return invite;
  }

  async getInvite(token: string) {
    const invite = await this.repo.findInviteByToken(token);
    if (!invite) throw new AppError(404, "INVITE_NOT_FOUND");
    if (invite.usedAt) throw new AppError(410, "INVITE_ALREADY_USED");
    if (invite.expiresAt < new Date()) throw new AppError(410, "INVITE_EXPIRED");
    return invite;
  }

  async acceptInvite(token: string, dto: Omit<CreateUserDto, "email" | "role" | "coachingRole" | "frontOfficeRole">) {
    const invite = await this.getInvite(token);

    if (dto.password !== dto.confirmedPassword) throw new AppError(400, "PASSWORD_MISMATCH");
    if (!/^\d{2,3}-\d{3,4}-\d{4}$/.test(dto.phoneNumber)) throw new AppError(400, "INVALID_PHONE_NUMBER");
    if (await this.repo.isNicknameTaken(dto.nickname)) throw new AppError(409, "NICKNAME_TAKEN");

    const password = await hashPassword(dto.password);
    const phoneNumber = encrypt(dto.phoneNumber);

    const user = await this.repo.createUser({
      email: invite.email,
      password,
      username: dto.username,
      nickname: dto.nickname,
      role: invite.role,
      coachingRole: invite.coachingRole ?? null,
      frontOfficeRole: invite.frontOfficeRole ?? null,
      dateOfBirth: new Date(dto.dateOfBirth),
      nationalityId: dto.nationalityId,
      phoneNumber,
    });
    await this.repo.markInviteUsed(invite.id);
    return user;
  }

  listInvites() {
    return this.repo.listInvites();
  }

  async me(id: number) {
    const user = await this.repo.findById(id);
    if (!user) throw new AppError(404, "USER_NOT_FOUND");
    return user;
  }
}
