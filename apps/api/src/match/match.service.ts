import fs from "fs";
import path from "path";
import { MatchRepository } from "./match.repo";
import { AppError } from "../lib/appError";
import { anthropic } from "../lib/claude";
import {
  CreateMatchDto,
  UpdateMatchDto,
  MatchListQuery,
  UpsertPlayerStatsDto,
  UpsertTeamStatsDto,
  VALID_COMPETITION_TYPES,
  CreateShotEventDto,
  VALID_SHOT_RESULTS,
} from "./dto/match.dto";
import { Venue } from "../generated/enums";

const VALID_VENUES = Object.values(Venue);

export class MatchService {
  constructor(private repo: MatchRepository) {}

  getMatches(query: MatchListQuery) {
    if (query.competitionType !== undefined && !VALID_COMPETITION_TYPES.includes(query.competitionType)) {
      throw new AppError(400, "INVALID_COMPETITION_TYPE");
    }
    return this.repo.findAll(query);
  }

  async getMatchById(id: number) {
    const match = await this.repo.findById(id);
    if (!match) throw new AppError(404, "MATCH_NOT_FOUND");
    return match;
  }

  createMatch(dto: CreateMatchDto) {
    if (!VALID_COMPETITION_TYPES.includes(dto.competitionType)) {
      throw new AppError(400, "INVALID_COMPETITION_TYPE");
    }
    if (dto.venue !== undefined && !VALID_VENUES.includes(dto.venue)) {
      throw new AppError(400, "INVALID_VENUE");
    }
    return this.repo.create(dto);
  }

  async updateMatch(id: number, dto: UpdateMatchDto) {
    const match = await this.repo.findById(id);
    if (!match) throw new AppError(404, "MATCH_NOT_FOUND");
    if (dto.competitionType !== undefined && !VALID_COMPETITION_TYPES.includes(dto.competitionType)) {
      throw new AppError(400, "INVALID_COMPETITION_TYPE");
    }
    if (dto.venue !== undefined && !VALID_VENUES.includes(dto.venue)) {
      throw new AppError(400, "INVALID_VENUE");
    }
    if ((dto.homeScore !== undefined || dto.awayScore !== undefined) && !match.hasSquad) {
      throw new AppError(409, "SQUAD_REQUIRED");
    }
    return this.repo.update(id, dto);
  }

  async upsertPlayerStats(matchId: number, dto: UpsertPlayerStatsDto) {
    const match = await this.repo.findById(matchId);
    if (!match) throw new AppError(404, "MATCH_NOT_FOUND");

    // 키패스가 있으면 패스 시도도 반드시 있어야 함
    if ((dto.keyPasses ?? 0) > 0 && !dto.passesAttempted) {
      throw new AppError(400, "KEY_PASS_REQUIRES_PASSES_ATTEMPTED");
    }
    // 도움이 있으면 xA도 반드시 있어야 함
    if ((dto.assists ?? 0) > 0 && !dto.xA) {
      throw new AppError(400, "ASSIST_REQUIRES_XA");
    }
    // 득점이 있으면 xG도 반드시 있어야 함
    if ((dto.goals ?? 0) > 0 && !dto.xG) {
      throw new AppError(400, "GOAL_REQUIRES_XG");
    }

    const existing = await this.repo.findPlayerStats(matchId, dto.playerId);
    const result = existing
      ? await this.repo.updatePlayerStats(existing.id, dto)
      : await this.repo.createPlayerStats(matchId, dto);
    await this.repo.recalculateTeamStats(matchId);
    return result;
  }

  async upsertTeamStats(matchId: number, dto: UpsertTeamStatsDto) {
    const match = await this.repo.findById(matchId);
    if (!match) throw new AppError(404, "MATCH_NOT_FOUND");
    return this.repo.upsertTeamStats(matchId, dto);
  }

  getShotEvents(matchId: number) {
    return this.repo.findShotEvents(matchId);
  }

  async createShotEvent(matchId: number, dto: CreateShotEventDto) {
    const match = await this.repo.findById(matchId);
    if (!match) throw new AppError(404, "MATCH_NOT_FOUND");
    if (!VALID_SHOT_RESULTS.includes(dto.result)) throw new AppError(400, "INVALID_SHOT_RESULT");
    if (typeof dto.xG !== 'number' || dto.xG < 0 || dto.xG > 1) {
      throw new AppError(400, "INVALID_XG_VALUE");
    }
    const event = await this.repo.createShotEvent(matchId, dto);
    await this.repo.recalculateXgXa(matchId);
    await this.repo.recalculateTeamStats(matchId);
    return event;
  }

  async deleteShotEvent(matchId: number, eventId: number) {
    await this.repo.deleteShotEvent(eventId);
    await this.repo.recalculateXgXa(matchId);
    await this.repo.recalculateTeamStats(matchId);
  }

  async uploadStatSheet(matchId: number, filePath: string, originalName: string) {
    const match = await this.repo.findById(matchId);
    if (!match) throw new AppError(404, "MATCH_NOT_FOUND");

    if (!process.env["ANTHROPIC_API_KEY"]) {
      throw new AppError(503, "AI_SERVICE_UNAVAILABLE");
    }

    const imageData = fs.readFileSync(filePath);
    const base64 = imageData.toString("base64");
    const ext = path.extname(originalName).toLowerCase();
    const mediaType = ext === ".png" ? "image/png" : "image/jpeg";

    let statSheetRaw: unknown;
    try {
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              {
                type: "text",
                text: `이 경기 기록지 이미지에서 스탯을 추출하여 아래 JSON 형식으로 반환하세요. 확인할 수 없는 값은 null로 설정하세요.
{
  "possession": { "home": <number|null>, "away": <number|null> },
  "shots": { "home": <number|null>, "away": <number|null> },
  "shotsOnTarget": { "home": <number|null>, "away": <number|null> },
  "goals": { "home": <number|null>, "away": <number|null> },
  "corners": { "home": <number|null>, "away": <number|null> },
  "fouls": { "home": <number|null>, "away": <number|null> },
  "yellowCards": { "home": <number|null>, "away": <number|null> },
  "redCards": { "home": <number|null>, "away": <number|null> },
  "scorers": [{ "name": <string>, "team": "home"|"away", "minute": <number|null> }]
}
JSON만 반환하고 다른 텍스트는 포함하지 마세요.`,
              },
            ],
          },
        ],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
      const jsonText = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      statSheetRaw = JSON.parse(jsonText);
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new AppError(422, "STAT_EXTRACTION_FAILED");
      }
      throw new AppError(503, "AI_SERVICE_UNAVAILABLE");
    }

    const relativePath = path.relative(process.cwd(), filePath);
    return this.repo.updateStatSheet(matchId, statSheetRaw, relativePath);
  }
}
