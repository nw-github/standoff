import { Pokemon } from "../game/pokemon";
import { moveList, type MoveId } from "../game/moveList";
import { speciesList, type Species, type SpeciesId } from "../game/species";
import { randChoice } from "../game/utils";
import { AlwaysFailMove } from "../game/moves";

export const battleFormats = ["randoms", "metronome"] as const;

export type FormatId = (typeof battleFormats)[number];

const getMovePool = () => {
    const movePool = Object.keys(moveList) as MoveId[];
    const bad: MoveId[] = ["payday", "absorb", "focusenergy"];
    for (const move of bad) {
        movePool.splice(movePool.indexOf(move), 1);
    }
    return movePool;
};

type FormatDesc = {
    generate?(): Pokemon[];
    validate?(team: Pokemon[]): string | undefined;
};

const getRandomPokemon = (
    count: number,
    validSpecies: (s: Species, id: SpeciesId) => boolean,
    customize: (id: SpeciesId) => Pokemon
) => {
    return (Object.keys(speciesList) as SpeciesId[])
        .filter(id => validSpecies(speciesList[id], id))
        .sort(() => Math.random() - 0.5)
        .slice(0, count)
        .map(id => customize(id));
};

export const formatDescs: Record<FormatId, FormatDesc> = {
    randoms: {
        generate() {
            const pool = getMovePool();
            const randomMoves = (moves: MoveId[] = [], count: number = 4) => {
                while (moves.length < count) {
                    if (!pool.length) {
                        pool.push(...getMovePool());
                    }

                    let move;
                    do {
                        move = randChoice(pool);
                    } while (
                        moves.includes(move) ||
                        move === "struggle" ||
                        moveList[move] instanceof AlwaysFailMove
                    );

                    pool.splice(pool.indexOf(move), 1);
                    moves.push(move);
                }
                return moves;
            };

            return getRandomPokemon(
                6,
                () => true,
                s => new Pokemon(s, {}, {}, 100, randomMoves())
            );
        },
    },
    metronome: {
        generate() {
            return getRandomPokemon(
                6,
                () => true,
                s => new Pokemon(s, {}, {}, 100, ["metronome"])
            );
        },
    },
};
