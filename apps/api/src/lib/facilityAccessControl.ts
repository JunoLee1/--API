import type { FacilityZone } from "../generated/enums";

type Role = string;
type FrontOfficeRole = string | null | undefined;

const ASSET_MANAGER_ONLY_ZONES: FacilityZone[] = ["MECHANICAL", "STRUCTURAL", "SANITATION"];

export const ZONE_ACCESS_RULES: Record<FacilityZone, Role[]> = {
  GROUND:      ["ADMIN", "SUPER_ADMIN", "GM", "COACHING_STAFF", "PLAYER", "FRONT_OFFICE"],
  MECHANICAL:  ["ADMIN", "SUPER_ADMIN", "GM"],
  STRUCTURAL:  ["ADMIN", "SUPER_ADMIN", "GM"],
  SAFETY:      ["ADMIN", "SUPER_ADMIN", "GM", "FRONT_OFFICE", "COACHING_STAFF"],
  SANITATION:  ["ADMIN", "SUPER_ADMIN", "GM"],
  OPERATIONS:  ["ADMIN", "SUPER_ADMIN", "GM", "FRONT_OFFICE"],
  LOCKER_ROOM: ["ADMIN", "SUPER_ADMIN", "GM", "COACHING_STAFF", "PLAYER"],
  MEDICAL_ROOM:["ADMIN", "SUPER_ADMIN", "GM", "COACHING_STAFF"],
  SHOWER_ROOM: ["ADMIN", "SUPER_ADMIN", "GM", "COACHING_STAFF", "PLAYER"],
};

export function canAccessZone(role: Role, zone: FacilityZone, frontOfficeRole?: FrontOfficeRole): boolean {
  if (role === "FRONT_OFFICE" && ASSET_MANAGER_ONLY_ZONES.includes(zone)) {
    return frontOfficeRole === "ASSET_MANAGER";
  }
  return ZONE_ACCESS_RULES[zone]?.includes(role) ?? false;
}
