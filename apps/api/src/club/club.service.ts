import { ClubRepository } from "./club.repo";
import { AppError } from "../lib/appError";
import { CreateClubDto, UpdateClubDto } from "./club.dto";

export class ClubService {
  constructor(private repo: ClubRepository) {}

  async getAll(requesterRole: string, requesterClubId?: number | null) {
    if (requesterRole === "SUPER_ADMIN") return this.repo.findAll();
    if (requesterClubId) return this.repo.findByIds([requesterClubId]);
    return [];
  }

  async getById(id: number) {
    const club = await this.repo.findById(id);
    if (!club) throw new AppError(404, "CLUB_NOT_FOUND");
    return club;
  }

  async create(dto: CreateClubDto) {
    if (typeof dto.name !== "string" || !dto.name.trim()) {
      throw new AppError(400, "INVALID_CLUB_NAME");
    }
    const trimmed = dto.name.trim();
    const existing = await this.repo.findByName(trimmed);
    if (existing) throw new AppError(409, "CLUB_NAME_ALREADY_EXISTS");
    return this.repo.create({ name: trimmed });
  }

  async update(id: number, dto: UpdateClubDto) {
    await this.getById(id);
    if (dto.name !== undefined) {
      if (typeof dto.name !== "string" || !dto.name.trim()) {
        throw new AppError(400, "INVALID_CLUB_NAME");
      }
      dto = { ...dto, name: dto.name.trim() };
    }
    return this.repo.update(id, dto);
  }
}
