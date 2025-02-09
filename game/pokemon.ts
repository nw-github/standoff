import { moveList, type MoveId } from "./moveList";
import { speciesList, type SpeciesId } from "./species";
import { statKeys, type StageStats, type Stats } from "./utils";

export type Status = "psn" | "par" | "slp" | "frz" | "tox" | "brn";

export class Pokemon {
  readonly stats: Stats;
  readonly speciesId: SpeciesId;
  readonly level: number;
  readonly name: string;
  readonly moves: MoveId[];
  pp: number[];
  hp: number;
  status?: Status;
  sleepTurns: number = 0;

  constructor(
    speciesId: SpeciesId,
    dvs: Partial<StageStats>,
    statexp: Partial<Stats>,
    level: number,
    moves: MoveId[],
    name?: string
  ) {
    dvs.atk ??= 15;
    dvs.def ??= 15;
    dvs.spc ??= 15;
    dvs.spe ??= 15;
    const hp = ((dvs.atk & 1) << 3) | ((dvs.def & 1) << 2) | ((dvs.spc & 1) << 1) | (dvs.spe & 1);

    const calcStatBase = (stat: keyof Stats) => {
      return calcStat(
        this.species.stats[stat],
        level,
        stat === "hp" ? hp : dvs[stat],
        statexp[stat]
      );
    };

    this.speciesId = speciesId;
    this.name = name ?? this.species.name;
    this.moves = moves;
    this.pp = moves.map(move => moveList[move].pp);
    this.level = level;
    // https://bulbapedia.bulbagarden.net/wiki/Individual_values#Usage
    this.stats = {
      hp: calcStatBase("hp") + level + 5,
      atk: calcStatBase("atk"),
      def: calcStatBase("def"),
      spc: calcStatBase("spc"),
      spe: calcStatBase("spe"),
    };
    this.hp = this.stats.hp;
  }

  get species() {
    return speciesList[this.speciesId];
  }

  static fromString(src: string) {
    const moves: MoveId[] = [];
    const dvs: Partial<Stats> = {};
    const statexp: Partial<Stats> = {};
    let level = 100;
    let name = "";
    let speciesName = "";

    const lines = src.split("\n");

    let match;
    if ((match = lines[0].match(nameWithSpecies))) {
      speciesName = match[2].toLowerCase();
      name = match[1];
    } else {
      speciesName = lines[0].toLowerCase();
    }

    const problems = [];
    outer: for (const line of lines.slice(1)) {
      if ((match = line.match(pokeLevel))) {
        level = +match[1];
      } else if ((match = line.match(evs)) || (match = line.match(ivs))) {
        // EVs and IVs for smogon compatibility
        const isEvs = match[0].toLowerCase().includes("evs");
        for (const [, v, s] of match[1].matchAll(statRegex)) {
          const value = +v;
          const stat = s.toLowerCase();
          if (!(statKeys as readonly string[]).includes(stat.toLowerCase())) {
            problems.push(`Invalid stat '${stat}'`);
          }

          if (value < 0 || (isEvs && value > 255) || (!isEvs && value > 15)) {
            problems.push(`Invalid ${isEvs ? "EV" : "IV"} value '${value}'`);
          }

          if (isEvs) {
            // FIXME: this is wrong
            statexp[stat as keyof Stats] = Math.floor(value * 257);
          } else {
            if (stat === "hp") {
              problems.push(`Cannot set HP IV, it is dependent on the value of the other IVs`);
            }

            dvs[stat as keyof Stats] = Math.floor(value / 2);
          }
        }
      } else if ((match = line.match(move))) {
        for (const move in moveList) {
          if (moveList[move as MoveId].name.toLowerCase() === match[1].toLowerCase()) {
            moves.push(move as MoveId);
            continue outer;
          }
        }

        problems.push(`Invalid move '${match[1]}'`);
      }
    }

    for (const species in speciesList) {
      if (speciesList[species as SpeciesId].name.toLowerCase() === speciesName) {
        if (problems.length) {
          return problems;
        }

        return new Pokemon(species as SpeciesId, dvs, statexp, level, moves, name);
      }
    }

    problems.push(`Invalid species '${speciesName}'`);
    return problems;
  }
}

export const calcStat = (base: number, level: number, dv?: number, statexp?: number) => {
  const s = Math.min(Math.ceil(Math.sqrt(statexp ?? 65535)), 255);
  return Math.floor((((base + (dv ?? 15)) * 2 + s / 4) * level) / 100) + 5;
};

const nameWithSpecies = /^\s*(.*?)\s*\((\w+)\)/;
const pokeLevel = /^\s*Level:\s*(\d+)/i;
const evs = /^EVs:\s*(\d+\s+\w+\s*\/?\s*)+/i;
const ivs = /^IVs:\s*(\d+\s+\w+\s*\/?\s*)+/i;
const move = /^\s*-\s*([\w\s]+)/i;
const statRegex = /\s*(\d+)\s+(\w+)\s*/;
