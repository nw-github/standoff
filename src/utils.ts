import { type Type } from "./pokemon";

export const randRangeInclusive = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const randChance255 = (num: number) => {
    return randRangeInclusive(0, 255) < Math.floor(Math.min(num, 255));
};

export const stageMultipliers: { [key: number]: number } = {
    "-6": 25,
    "-5": 28,
    "-4": 33,
    "-3": 40,
    "-2": 50,
    "-1": 66,
    "0": 100,
    "1": 150,
    "2": 200,
    "3": 250,
    "4": 300,
    "5": 350,
    "6": 400,
};

export const typeChart: { [key in Type]: { [key in Type]?: number } } = {
    normal: { ghost: 0 },
    rock: { bug: 2, fire: 2, flying: 2, ice: 2, fight: 0.5, ground: 0.5 },
    ground: { rock: 2, poison: 2, bug: 0.5, flying: 0, grass: 0.5, fire: 2, electric: 2 },
    ghost: { normal: 0, ghost: 2, psychic: 0 },
    poison: { rock: 0.5, ground: 0.5, ghost: 0.5, grass: 2 },
    bug: { ghost: 0.5, flying: 0.5, fight: 0.5, grass: 2, fire: 0.5, psychic: 2 },
    flying: { rock: 0.5, bug: 2, fight: 2, grass: 2, electric: 0.5 },
    fight: {
        normal: 2,
        rock: 2,
        ghost: 0,
        poison: 0.5,
        bug: 0.5,
        flying: 0.5,
        ice: 2,
        psychic: 0.5,
    },
    water: { rock: 2, ground: 2, water: 0.5, grass: 0.5, fire: 2, dragon: 0.5 },
    grass: {
        rock: 2,
        ground: 2,
        poison: 0.5,
        bug: 0.5,
        flying: 0.5,
        water: 2,
        fire: 0.5,
        dragon: 0.5,
        grass: 0.5,
    },
    fire: { rock: 0.5, bug: 2, water: 0.5, grass: 2, fire: 0.5, ice: 2, dragon: 0.5 },
    electric: { ground: 0, flying: 2, water: 2, grass: 0.5, electric: 0.5, dragon: 0.5 },
    ice: { ground: 2, flying: 2, water: 0.5, grass: 2, ice: 0.5, dragon: 2 },
    psychic: { poison: 2, fight: 2, psychic: 0.5 },
    dragon: { dragon: 2 },
};
