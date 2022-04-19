import { Env } from "../services"

export const RATINGS_ROLES_MAP = {
  1: Env.grayRatedRoleID,
  2: Env.greenRatedRoleID,
  3: Env.blueRatedRoleID,
  4: Env.yellowRatedRoleID,
  5: Env.redRatedRoleID,
  6: Env.targetRatedRoleID
}

/** TC rating helper */
export function getRatingLevel(rating: Number | string) {
  if (rating < 900) return 1;
  if (rating < 1200) return 2;
  if (rating < 1500) return 3;
  if (rating < 2200) return 4;
  if (rating < 3000) return 5;
  return 6;
}
