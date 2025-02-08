import type { Status } from "~/game/pokemon";
import type { Type } from "~/game/utils";

export const typeColor: Record<Type, string> = {
  normal: "#ACAC7B",
  rock: "#BDA439",
  ground: "#E6C56A",
  ghost: "#735A9C",
  poison: "#A441A4",
  bug: "#ACBD20",
  flying: "#AC94F6",
  fight: "#C53129",
  water: "#6A94F6",
  grass: "#7BCD52",
  fire: "#F68331",
  electric: "#FFD531",
  ice: "#9CDEDE",
  psychic: "#FF5A8B",
  dragon: "#7339FF",
};

export const statusColor: Record<Status, string> = {
  psn: "#c562c5",
  tox: "#c562c5",
  brn: "#e67352",
  frz: "#8bb4e6",
  slp: "#a4a48b",
  par: "#bebe18",
};
