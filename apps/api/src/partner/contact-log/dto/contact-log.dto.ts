import type { ContactChannel } from "../../../generated/enums";

export interface CreateContactLogDto {
  channel: ContactChannel;
  contactedAt: string;
  summary: string;
  nextActionDate?: string;
  nextActionNote?: string;
}
