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
    readonly name: string;
};

export type SpeciesId = keyof typeof speciesList;

export const speciesList = {
    mewtwo: {
        dexId: 150,
        name: "Mewtwo",
        types: ["psychic"],
        moves: [],
        stats: {
            hp: 106,
            atk: 110,
            def: 90,
            spc: 154,
            spe: 130,
        },
    } as Species,
    tauros: {
        dexId: 128,
        name: "Tauros",
        types: ["normal"],
        moves: [],
        stats: {
            hp: 75,
            atk: 100,
            def: 95,
            spc: 70,
            spe: 110,
        },
    } as Species,
};
