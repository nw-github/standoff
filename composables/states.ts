import { moveList, type MoveId } from "~/game/moveList";
import { parsePokemon } from "~/game/pokemon";
import { speciesList, type SpeciesId } from "~/game/species";
import type { Stats } from "~/game/utils";

export const useMyId = () => {
  const { user } = useUserSession();
  return computed(() => user.value?.id ?? "");
};

export type Team = {
  name: string;
  pokemon: EditPokemon[];
  format: FormatId;
};

export type EditPokemon = {
  dvs: Partial<Stats>;
  statexp: Partial<Stats>;
  level: number;
  name: string;
  species: SpeciesId;
  moves: MoveId[];
};

export const serializeTeam = (team: Team) => team.pokemon.map(pokeToString).join("\n\n");

export const pokeToString = (poke: EditPokemon) => {
  const stats = (stats: Partial<Stats>, def: number, name: string, cvt: (v: number) => number) => {
    const result = [];
    for (const k in stats) {
      if (stats[k as keyof Stats] !== def) {
        result.push(`${cvt(stats[k as keyof Stats]!)} ${k}`);
      }
    }

    if (result.length) {
      return `${name}: ${result.join(" / ")}\n`;
    } else {
      return "";
    }
  };

  let result = "";
  if (poke.name !== speciesList[poke.species].name) {
    result += `${poke.name} (${speciesList[poke.species].name})\n`;
  } else {
    result += `${speciesList[poke.species].name}\n`;
  }

  if (poke.level !== 100) {
    result += `Level: ${poke.level}\n`;
  }

  result += stats(poke.dvs, 65535, "EVs", v => Math.floor(v / 257));
  result += stats(poke.statexp, 15, "IVs", v => v * 2);
  for (const move of poke.moves) {
    result += ` - ${moveList[move].name}\n`;
  }
  return result;
};

export const pokeFromString = (src: string) => {
  const result = parsePokemon(src);
  if (Array.isArray(result)) {
    return result;
  }

  result.name ??= speciesList[result.species].name;
  return result as EditPokemon;
};

export const useMyTeams = () => useLocalStorage<Team[]>("myTeams", () => []);

export const useCurrentTrack = () => useState<string | undefined>("currentTrack", () => undefined);

export const allMusicTracks = Object.keys(import.meta.glob("/public/music/**/*.{mp3,wav}"));

export const musicTrackName = (track: string) => {
  return track.slice(track.lastIndexOf("/") + 1, track.lastIndexOf("."));
};

export const useSfxVolume = () => useLocalStorage("sfxVolume", () => 0.8);

export const useMusicVolume = () => useLocalStorage("musicVolume", () => 1.0);
