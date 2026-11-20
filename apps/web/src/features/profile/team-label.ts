import type { Team } from "@quack/contracts/identity/profile";

export const teamLabel = (team: Team) => team.slice(0, 1).toUpperCase() + team.slice(1);
