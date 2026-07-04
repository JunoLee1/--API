import { AuthRepository } from "./auth.repo";
import { generateToken } from "../lib/token";
import { hashedPassword, match } from "../lib/hash";
import CountryService from "../country/country.service";
import { encrypt } from "../lib/crypto";
import {
  FindAdvisorsServiceDto,
  SignUpInputServiceDto,
  LoginInputServiceDto,
  LoginOutputServiceDto,
  FindAdvisorsOutputDto,
} from "./dto/auth.service.dto";
import { SignUpOutputDto } from "./dto/auth.repo.dto";
import { AppError } from "../lib/appError";

export default class AuthService {
  constructor(
    private repo: AuthRepository,
    private countryService: CountryService,
  ) {}

  async signUp({
    email,
    password,
    nickname,
    username,
    nationality,
    confirmedPassword,
    role,
    phoneNumber,
    dateOfBirth,
  }: SignUpInputServiceDto): Promise<SignUpOutputDto> {
    if (!email) throw new AppError(400, "INVALID_EMAIL");
    if (!nickname) throw new AppError(400, "INVALID_NICKNAME");
    if (!password) throw new AppError(400, "INVALID_PASSWORD");

    if (await this.repo.isEmailDuplicated(email)) {
      throw new AppError(409, "DUPLICATED_EMAIL");
    }

    const countryCodeChecker = await this.countryService.getCountryByCode(nationality.code);
    if (!countryCodeChecker) throw new AppError(400, "INVALID_NATIONALITY_CODE");

    if (await this.repo.isNicknameDuplicated(nickname)) {
      throw new AppError(409, "DUPLICATED_NICKNAME");
    }

    if (password !== confirmedPassword) {
      throw new AppError(400, "PASSWORD_NOT_MATCH");
    }

    const hashPassword = await hashedPassword(password);
    const encryptedPhone = await encrypt(phoneNumber);

    if (await this.repo.isDuplicatedPhoneNumber(encryptedPhone.encrypted)) {
      throw new AppError(409, "DUPLICATED_PHONENUMBER");
    }

    const newUser = await this.repo.createAdmin({
      email,
      password: hashPassword,
      nickname,
      username,
      role,
      dateOfBirth,
      nationality,
      phoneNumber: encryptedPhone,
    });

    return {
      email: newUser.email,
      username: newUser.username,
      nickname: newUser.nickname,
      dateOfBirth: newUser.dateOfBirth,
      nationality: {
        id: newUser.nationality.id,
        name: newUser.nationality.name,
        code: newUser.nationality.code,
      },
      role: newUser.role,
    };
  }

  async login({ email, password }: LoginInputServiceDto): Promise<LoginOutputServiceDto> {
    const user = await this.repo.findByEmail(email);
    if (!user) throw new AppError(400, "INVALID_USER_EMAIL");

    const isMatched = await match(password, user.password);
    if (!isMatched) throw new AppError(400, "WRONG_PASSWORD");

    const { accessToken, refreshToken } = await generateToken(user.id);
    return { accessToken, refreshToken };
  }

  async findAdvisorById(id: number) {
    const user = await this.repo.findAdvisorById(id);
    if (!user) throw new AppError(404, "NOT_FOUND");
    return {
      id: user.id,
      username: user.username,
      email: user.email,
    };
  }

  async findAdvisors({ take, skip, username }: FindAdvisorsServiceDto): Promise<FindAdvisorsOutputDto> {
    const where: any = {};
    if (username) where.username = username;

    const users = await this.repo.findAdvisors({ where });
    return users.map((u) => ({
      email: u.email,
      username: u.username,
      nickname: u.nickname,
    }));
  }

  async updatesAdvisor(data: any) {
    const { id, email, username, password, role, dateOfBirth, nickname, isDeleted } = data;

    const user = await this.repo.findAdvisorById(id);
    if (!user) throw new AppError(404, "NOT_FOUND");

    const updatedData: any = {};
    if (email !== undefined) updatedData.email = email;
    if (username !== undefined) updatedData.username = username;
    if (nickname !== undefined) updatedData.nickname = nickname;
    if (password !== undefined) updatedData.password = password;
    if (dateOfBirth !== undefined) updatedData.dateOfBirth = dateOfBirth;
    if (role !== undefined) updatedData.role = role;
    if (isDeleted !== undefined) updatedData.isDeleted = isDeleted;

    return await this.repo.updatesAdvisor(id, updatedData);
  }

  async delete(id: number) {
    const user = await this.repo.findAdvisorById(id);
    if (!user) throw new AppError(404, "NOT_FOUND");

    if (user.isDeleted) {
      return await this.repo.updatesAdvisor(id, { isDeleted: false });
    }
    return await this.repo.updatesAdvisor(id, { isDeleted: true });
  }

  async deleteMany(data: { id: number }[]) {
    const ids = data.map((item) => item.id);
    const users = await this.repo.findAdvisorsByIds(ids);
    if (!users.length) throw new AppError(404, "NOT_FOUND");

    const activeIds = users.filter((u) => !u.isDeleted).map((u) => u.id);
    if (!activeIds.length) return [];

    return await this.repo.deleteMany({ ids: activeIds, isDeleted: true });
  }
}
