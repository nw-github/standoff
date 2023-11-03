export type Type =
    | "normal"
    | "rock"
    | "ground"
    | "ghost"
    | "poison"
    | "bug"
    | "flying"
    | "fight"
    | "water"
    | "grass"
    | "fire"
    | "electric"
    | "ice"
    | "psychic"
    | "dragon";

export type Stats = {
    hp: number;
    atk: number;
    def: number;
    spc: number;
    spe: number;
};

export type OptStats = {
    hp?: number;
    atk?: number;
    def?: number;
    spc?: number;
    spe?: number;
};

export type Species = {
    readonly id: number;
    readonly types: [Type, Type?];
    readonly moves: string[];
    readonly stats: Stats;
    readonly weight: number;
};

export class Pokemon {
    public readonly stats: Stats;
    public readonly species: Species;

    constructor(species: Species, dvs: OptStats, statexp: OptStats, level: number) {
        dvs.atk ??= 0;
        dvs.def ??= 0;
        dvs.spc ??= 0;
        dvs.spe ??= 0;
        dvs.hp = ((dvs.atk & 1) << 3) | ((dvs.def & 1) << 2) | ((dvs.spc & 1) << 1) | (dvs.spe & 1);

        const calcStatBase = (stat: keyof Stats) => {
            let s = Math.min(Math.ceil(Math.sqrt(statexp[stat] ?? 0)), 255);
            return Math.floor((((species.stats[stat] + dvs[stat]!) * 2 + s / 4) * level) / 100);
        };

        this.species = species;
        this.stats = {
            hp: calcStatBase("hp") + level + 10,
            atk: calcStatBase("atk") + 5,
            def: calcStatBase("def") + 5,
            spc: calcStatBase("spc") + 5,
            spe: calcStatBase("spe") + 5,
        };
    }
}
