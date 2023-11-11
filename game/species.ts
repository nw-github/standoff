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
    alakazam: {
        dexId: 65,
        name: "Alakazam",
        types: ["psychic"],
        moves: [],
        stats: {
            hp: 55,
            atk: 50,
            def: 45,
            spc: 135,
            spe: 120,
        },
    } as Species,
    exeggutor: {
        dexId: 103,
        name: "Exeggutor",
        types: ["grass", "psychic"],
        moves: [],
        stats: {
            hp: 95,
            atk: 95,
            def: 85,
            spc: 125,
            spe: 55,
        },
    } as Species,
    starmie: {
        dexId: 121,
        name: "Starmie",
        types: ["water", "psychic"],
        moves: [],
        stats: {
            hp: 60,
            atk: 75,
            def: 85,
            spc: 100,
            spe: 115,
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
    snorlax: {
        dexId: 143,
        name: "Snorlax",
        types: ["normal"],
        moves: [],
        stats: {
            hp: 160,
            atk: 110,
            def: 65,
            spc: 65,
            spe: 30,
        },
    } as Species,
    zapdos: {
        dexId: 145,
        name: "Zapdos",
        types: ["electric", "flying"],
        moves: [],
        stats: {
            hp: 90,
            atk: 90,
            def: 85,
            spc: 125,
            spe: 100,
        },
    } as Species,
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
};
