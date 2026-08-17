import type { FacilityZone } from "../generated/enums";

type Role = string;

export const ZONE_ACCESS_RULES: Record<FacilityZone, Role[]> = {
  GROUND:      ["ADMIN", "SUPER_ADMIN", "GM", "COACHING_STAFF", "PLAYER", "FRONT_OFFICE"],
  MECHANICAL:  ["ADMIN", "SUPER_ADMIN", "GM", "FRONT_OFFICE"],
  STRUCTURAL:  ["ADMIN", "SUPER_ADMIN", "GM", "FRONT_OFFICE"],
  SAFETY:      ["ADMIN", "SUPER_ADMIN", "GM", "FRONT_OFFICE", "COACHING_STAFF"],
  SANITATION:  ["ADMIN", "SUPER_ADMIN", "GM", "FRONT_OFFICE"],
  OPERATIONS:  ["ADMIN", "SUPER_ADMIN", "GM", "FRONT_OFFICE"],
  LOCKER_ROOM: ["ADMIN", "SUPER_ADMIN", "GM", "COACHING_STAFF", "PLAYER"],
  MEDICAL_ROOM:["ADMIN", "SUPER_ADMIN", "GM", "COACHING_STAFF"],
  SHOWER_ROOM: ["ADMIN", "SUPER_ADMIN", "GM", "COACHING_STAFF", "PLAYER"],
};

export function canAccessZone(role: Role, zone: FacilityZone): boolean {
  return ZONE_ACCESS_RULES[zone]?.includes(role) ?? false;
}
