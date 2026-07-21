import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { MatchSquadRepository } from "../match/match.squad.repo";
import { NotificationService } from "../notification/notification.service";
import { NotificationRepository } from "../notification/notification.repo";

export function startMatchDayNotificationJob() {
  cron.schedule("0 18 * * *", async () => {
    const prisma = getPrisma();
    const squadRepo = new MatchSquadRepository(prisma);
    const notifService = new NotificationService(new NotificationRepository(prisma));

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const entries = await squadRepo.findUnnotifiedForDate(tomorrow);
    if (entries.length === 0) return;

    const matchGroups = new Map<number, typeof entries>();
    for (const entry of entries) {
      const list = matchGroups.get(entry.matchId) ?? [];
      list.push(entry);
      matchGroups.set(entry.matchId, list);
    }

    for (const [matchId, squadEntries] of matchGroups) {
      const matchInfo = squadEntries[0]!.match;
      for (const entry of squadEntries) {
        const userId = entry.player.userId;
        if (!userId) continue;
        void notifService
          .notifyMatchDayReminder(userId, {
            date: matchInfo.date,
            homeTeamName: matchInfo.homeTeamName,
            awayTeamName: matchInfo.awayTeamName,
            venue: matchInfo.venue ?? null,
          })
          .catch(console.error);
      }
      void squadRepo.markNotified(matchId).catch(console.error);
    }
  });
}
