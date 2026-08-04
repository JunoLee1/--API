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

  create(dto: CreateClubDto) {
    return this.repo.create(dto);
  }

  async update(id: number, dto: UpdateClubDto) {
    await this.getById(id);
    return this.repo.update(id, dto);
  }
}
