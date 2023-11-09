import { moveList, type MoveId } from "./moveList";
import { speciesList, type Stats, type SpeciesId } from "./species";

export type Status = "psn" | "par" | "slp" | "frz" | "tox" | "brn";

export type OptStats = {
    hp?: number;
    atk?: number;
    def?: number;
    spc?: number;
    spe?: number;
};

export class Pokemon {
    public readonly stats: Stats;
    public readonly speciesId: SpeciesId;
    public readonly level: number;
    public readonly name: string;
    public readonly moves: MoveId[];
    public pp: number[];
    public hp: number;
    public status: Status | null;

    constructor(
        speciesId: SpeciesId,
        dvs: OptStats,
        statexp: OptStats,
        level: number,
        moves: MoveId[],
        name?: string
    ) {
        dvs.atk ??= 0;
        dvs.def ??= 0;
        dvs.spc ??= 0;
        dvs.spe ??= 0;
        dvs.hp = ((dvs.atk & 1) << 3) | ((dvs.def & 1) << 2) | ((dvs.spc & 1) << 1) | (dvs.spe & 1);

        const calcStatBase = (stat: keyof Stats) => {
            const s = Math.min(Math.ceil(Math.sqrt(statexp[stat] ?? 0)), 255);
            return Math.floor((((this.species.stats[stat] + dvs[stat]!) * 2 + s / 4) * level) / 100);
        };

        this.speciesId = speciesId;
        this.name = name ?? this.species.name;
        this.status = null;
        this.moves = moves;
        this.pp = moves.map(move => moveList[move].pp);
        this.level = level;
        // https://bulbapedia.bulbagarden.net/wiki/Individual_values#Usage
        this.stats = {
            hp: calcStatBase("hp") + level + 10,
            atk: calcStatBase("atk") + 5,
            def: calcStatBase("def") + 5,
            spc: calcStatBase("spc") + 5,
            spe: calcStatBase("spe") + 5,
        };
        this.hp = this.stats.hp;
    }

    get species() {
        return speciesList[this.speciesId];
    }
}
