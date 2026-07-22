import { z } from "zod";

export const CreateYouthRegistrationSchema = z.object({
  playerName: z.string().min(1),
  birthDate: z.string().datetime(),
  preferredJerseyNumber: z.number().int().min(1).max(99).optional(),
  teamId: z.number().int(),
  guardianEmail: z.string().email(),
});

export const RejectYouthRegistrationSchema = z.object({
  rejectionReason: z.string().min(1),
});

export const YouthRegistrationListQuerySchema = z.object({
  teamId: z.coerce.number().int().optional(),
  status: z.enum(["PENDING", "GUARDIAN_APPROVED", "CONTRACTED", "REJECTED"]).optional(),
});

export type CreateYouthRegistrationDto = z.infer<typeof CreateYouthRegistrationSchema>;
export type RejectYouthRegistrationDto = z.infer<typeof RejectYouthRegistrationSchema>;
export type YouthRegistrationListQuery = z.infer<typeof YouthRegistrationListQuerySchema>;
