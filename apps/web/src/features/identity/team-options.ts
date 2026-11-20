import { Team } from "@quack/contracts/identity/profile";

export const teamOptions = Team.literals.map((team) => ({
  value: team,
  label: team.slice(0, 1).toUpperCase() + team.slice(1),
}));
