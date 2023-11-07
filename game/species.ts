import type { Type } from "./utils";

export type Stats = {
    hp: number;
    atk: number;
    def: number;
    spc: number;
    spe: number;
};

export type Species = {
    readonly dexId: number;
    readonly types: [Type, ...Type[]];
    readonly moves: string[];
    readonly stats: Stats;
    readonly weight: number;
    readonly name: string;
};

export type SpeciesId = keyof typeof speciesList;

export const speciesList = {
    "mewtwo": {
        dexId: 150,
        name: "Mewtwo",
        types: ["psychic"],
        moves: [],
        weight: 1220,
        stats: {
            hp: 106,
            atk: 110,
            def: 90,
            spc: 154,
            spe: 130,
        },
    } as Species,
};
