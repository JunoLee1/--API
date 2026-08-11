import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/client";
import { encrypt, validatePhoneEncryptionKey } from "../../src/lib/crypto";

async function main() {
  validatePhoneEncryptionKey();
  const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] });
  const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

  const players = await prisma.player.findMany({
    select: {
      id: true,
      dateOfBirth: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      emergencyContactRelation: true,
    },
  });

  console.log(`Backfilling ${players.length} players...`);

  let count = 0;
  for (const player of players) {
    const updates: Record<string, string> = {};

    if (player.dateOfBirth) {
      const { encrypted, iv } = encrypt(player.dateOfBirth.toISOString());
      updates["dateOfBirthEncrypted"] = encrypted;
      updates["dateOfBirthIv"] = iv;
    }
    if (player.emergencyContactName) {
      const { encrypted, iv } = encrypt(player.emergencyContactName);
      updates["emergencyContactNameEncrypted"] = encrypted;
      updates["emergencyContactNameIv"] = iv;
    }
    if (player.emergencyContactPhone) {
      const { encrypted, iv } = encrypt(player.emergencyContactPhone);
      updates["emergencyContactPhoneEncrypted"] = encrypted;
      updates["emergencyContactPhoneIv"] = iv;
    }
    if (player.emergencyContactRelation) {
      const { encrypted, iv } = encrypt(player.emergencyContactRelation);
      updates["emergencyContactRelationEncrypted"] = encrypted;
      updates["emergencyContactRelationIv"] = iv;
    }

    if (Object.keys(updates).length > 0) {
      await (prisma.player as any).update({ where: { id: player.id }, data: updates });
    }
    count++;
    if (count % 100 === 0) console.log(`  ${count}/${players.length}`);
  }

  console.log(`Done. Encrypted PII for ${count} players.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
