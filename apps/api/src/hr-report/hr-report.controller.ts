import { Request, Response, NextFunction } from "express";
import { HrReportService } from "./hr-report.service";
import { AppError } from "../lib/appError";
import { getPrisma } from "../lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export class HrReportController {
  constructor(private service: HrReportService) {}

  getMonthly = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const now = new Date();
      const year = Number(req.query.year ?? now.getFullYear());
      const month = Number(req.query.month ?? now.getMonth() + 1);
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        throw new AppError(400, "INVALID_PERIOD");
      }
      res.json(await this.service.getMonthly(year, month));
    } catch (err) {
      next(err);
    }
  };

  getAnnual = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const year = Number(req.query.year ?? new Date().getFullYear());
      if (isNaN(year) || year < 2000 || year > 2100) {
        throw new AppError(400, "INVALID_YEAR");
      }
      res.json(await this.service.getAnnual(year));
    } catch (err) {
      next(err);
    }
  };

  getHiringPriorityQueue = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getHiringPriorityQueue(getPrisma()));
    } catch (err) {
      next(err);
    }
  };

  extractImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError(400, "IMAGE_REQUIRED");
      if (!process.env.ANTHROPIC_API_KEY) throw new AppError(503, "AI_NOT_AVAILABLE");

      const period = (req.body as { period?: string }).period ?? "monthly";
      const base64 = req.file.buffer.toString("base64");
      const mediaType = req.file.mimetype as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

      const fields =
        period === "annual"
          ? `avgHeadcount, totalRecruitment, annualTurnoverRate, avgAttendanceRate, totalIncidents,
             monthlyBreakdown(배열: [{month:1..12, headcount, turnoverRate, attendanceRate, incidents}]),
             totalAnnualWage, avgSalary, minSalary, maxSalary,
             dist300, dist300_500, dist500_1000, dist1000plus,
             annualTurnoverRateTurnover, totalDepartures, peakMonth,
             annualAttendanceRate, totalAbsences, worstMonth,
             totalIssues, totalInjuries, issuesByType, summary`
          : `ownPlayers, loanIn, onLoanOut, admin, frontOffice, coachingStaff, staffRecords,
             transfersIn, transfersOut, newContracts, openCoachingRounds, openJobPostings,
             present, absentUnauthorized, lateUnauthorized, absentAuthorized,
             totalIncidents, newInjuries, safeguardReports, notes`;

      const client = new Anthropic();
      const message = await client.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              {
                type: "text",
                text: `이 이미지는 축구 클럽의 HR ${period === "annual" ? "연말" : "월말"} 보고서입니다.
이미지에서 다음 필드를 읽어 JSON으로만 응답하세요 (설명 없이 JSON만):
${fields}
숫자 필드는 숫자로, 텍스트 필드는 문자열로 반환하세요. 값을 찾을 수 없으면 null로 반환하세요.`,
              },
            ],
          },
        ],
      });

      const raw = (message.content[0] as { type: string; text: string }).text.trim();
      const jsonStr = raw.startsWith("```") ? raw.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "") : raw;
      const extracted = JSON.parse(jsonStr);
      res.json(extracted);
    } catch (err) {
      next(err);
    }
  };
}
