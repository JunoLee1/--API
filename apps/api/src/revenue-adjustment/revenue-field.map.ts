import { LedgerEntryCategory, RevenueField } from "../generated/client";

export const FIELD_TO_CATEGORY: Partial<Record<RevenueField, LedgerEntryCategory>> = {
  TICKET:      "TICKET_SALES",
  SPONSORSHIP: "SPONSORSHIP",
  MERCHANDISE: "MERCHANDISE",
  ACADEMY_FEE: "ACADEMY_FEE",
  OTHER:       "OTHER",
  // BROADCAST, SUBSIDY, PARENT_COMPANY have no LedgerEntry category (external data)
};
