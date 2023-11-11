import type { ActivePokemon, Battle } from "./battle";

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

export const randRangeInclusive = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const randChance255 = (num: number) => {
    return randRangeInclusive(0, 255) < Math.floor(Math.min(num, 255));
};

export const randChoice = <T>(arr: T[]) => arr[randRangeInclusive(0, arr.length - 1)];

export const floatTo255 = (num: number) => {
    return Math.floor((num / 100) * 255);
};

export const clamp = (num: number, min: number, max: number) => {
    return Math.max(Math.min(num, max), min);
};

export const hpPercentExact = (current: number, max: number) => {
    return (current / max) * 100;
};

export const hpPercent = (current: number, max: number) => {
    return Math.round(hpPercentExact(current, max));
};

export const scaleAccuracy255 = (acc: number, user: ActivePokemon, target: ActivePokemon) => {
    // https://bulbapedia.bulbagarden.net/wiki/Accuracy#Generation_I_and_II
    return clamp(
        Math.floor(
            acc *
                (stageMultipliers[user.stages["acc"]] / 100) *
                (stageMultipliers[-target.stages["eva"]] / 100)
        ),
        1,
        255
    );
};

export const checkAccuracy = (
    acc: number,
    battle: Battle,
    user: ActivePokemon,
    target: ActivePokemon
) => {
    const chance = scaleAccuracy255(user.thrashing?.acc ?? floatTo255(acc), user, target);
    // https://www.smogon.com/dex/rb/moves/petal-dance/
    // https://www.youtube.com/watch?v=NC5gbJeExbs
    if (user.thrashing) {
        user.thrashing.acc = chance;
    }

    console.log(`Accuracy: ${acc} (${chance}/256)`);
    if (target.invuln || !randChance255(chance)) {
        battle.pushEvent({
            type: "failed",
            src: user.owner.id,
            why: "miss",
        });
        return false;
    }
    return true;
};

export const getEffectiveness = (atk: Type, def: Type[]) => {
    return def.reduce((eff, def) => eff * (typeChart[atk][def] ?? 1), 1);
};

export const isSpecial = (atk: Type) => {
    switch (atk) {
        case "normal":
        case "rock":
        case "ground":
        case "ghost":
        case "poison":
        case "bug":
        case "flying":
        case "fight":
            return false;
        case "water":
        case "grass":
        case "fire":
        case "electric":
        case "ice":
        case "psychic":
        case "dragon":
            return true;
    }
};

export const stageMultipliers: Record<number, number> = {
    [-6]: 25,
    [-5]: 28,
    [-4]: 33,
    [-3]: 40,
    [-2]: 50,
    [-1]: 66,
    0: 100,
    1: 150,
    2: 200,
    3: 250,
    4: 300,
    5: 350,
    6: 400,
};

export const typeChart: Record<Type, Partial<Record<Type, number>>> = {
    normal: { ghost: 0 },
    rock: { bug: 2, fire: 2, flying: 2, ice: 2, fight: 0.5, ground: 0.5 },
    ground: { rock: 2, poison: 2, bug: 0.5, flying: 0, grass: 0.5, fire: 2, electric: 2 },
    ghost: { normal: 0, ghost: 2, psychic: 0 },
    poison: { rock: 0.5, ground: 0.5, ghost: 0.5, grass: 2, bug: 2 },
    bug: { ghost: 0.5, flying: 0.5, fight: 0.5, grass: 2, fire: 0.5, psychic: 2, poison: 2 },
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
