import { moveList, type MoveId } from "~/game/moveList";
import { speciesList, type SpeciesId } from "~/game/species";
import type { Stats } from "~/game/utils";

const myId = ref("");
export const useMyId = () => myId;

export type Team = {
  name: string;
  pokemon: EditPokemon[];
  format: FormatId;
};

export class EditPokemon {
  evs: Partial<Stats> = {};
  ivs: Partial<Stats> = {};
  level = 100;
  name: string;

  constructor(public speciesId: SpeciesId, public moves: MoveId[], name?: string) {
    this.name = name ?? speciesList[speciesId].name;
  }

  get species() {
    return speciesList[this.speciesId];
  }

  toString() {
    const stats = (stats: Partial<Stats>, def: number, name: string) => {
      const result = [];
      for (const k in stats) {
        if (stats[k as keyof Stats] !== def) {
          result.push(`${stats[k as keyof Stats]} ${k}`);
        }
      }

      if (result.length) {
        return `${name}: ${result.join(" / ")}\n`;
      } else {
        return "";
      }
    };

    let result = "";
    if (this.name !== this.species.name) {
      result += `${this.name} (${this.species.name})\n`;
    }

    if (this.level !== 100) {
      result += `Level: ${this.level}\n`;
    }

    result += stats(this.evs, 252, "EVs");
    result += stats(this.ivs, 31, "IVs");
    for (const move of this.moves) {
      result += ` - ${moveList[move].name}`;
    }
    return result;
  }
}

export const myTeams = ref<Team[]>([
  {
    name: "Test",
    format: "standard",
    pokemon: [
      new EditPokemon("mewtwo", ["psychic"], "MewTwo|"),
      new EditPokemon("zapdos", ["drillpeck"], "Zapdos|"),
      new EditPokemon("arcanine", ["fireblast"], "Arcanine|"),
      new EditPokemon("tauros", ["bodyslam"], "Tauros|"),
      new EditPokemon("alakazam", ["psychic"], "Alakazam|"),
      new EditPokemon("articuno", ["blizzard"], "Articuno|"),
    ],
  },
  {
    name: "Test2",
    format: "nfe",
    pokemon: [
      new EditPokemon("mewtwo", ["psychic"], "MewTwo|"),
      new EditPokemon("zapdos", ["drillpeck"], "Zapdos|"),
      new EditPokemon("arcanine", ["fireblast"], "Arcanine|"),
      new EditPokemon("tauros", ["bodyslam"], "Tauros|"),
      new EditPokemon("alakazam", ["psychic"], "Alakazam|"),
      new EditPokemon("articuno", ["blizzard"], "Articuno|"),
    ],
  },
]);
