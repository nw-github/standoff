import { Pokemon } from "../game/pokemon";
import { moveList, type MoveId } from "../game/moveList";
import { speciesList, type Species, type SpeciesId } from "../game/species";
import { randChoice } from "../game/utils";
import { AlwaysFailMove, TrappingMove } from "../game/moves";

export const battleFormats = ["truly_randoms", "randoms", "metronome"] as const;

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
    customize: (s: Species, id: SpeciesId) => Pokemon
) => {
    return (Object.keys(speciesList) as SpeciesId[])
        .filter(id => validSpecies(speciesList[id], id))
        .sort(() => Math.random() - 0.5)
        .slice(0, count)
        .map(id => customize(speciesList[id], id));
};

const randomMove = (pool: MoveId[], moves: MoveId[]) => {
    let move;
    do {
        move = randChoice(pool);
    } while (
        moves.includes(move) ||
        move === "struggle" ||
        move === "mimic" || 
        move === "rage" || 
        move === "bide" || 
        move === "counter" ||
        moveList[move] instanceof AlwaysFailMove ||
        moveList[move] instanceof TrappingMove
    );
    return move;
};

export const formatDescs: Record<FormatId, FormatDesc> = {
    truly_randoms: {
        generate() {
            const pool = getMovePool();
            const randomMoves = (moves: MoveId[] = [], count: number = 4) => {
                while (moves.length < count) {
                    if (!pool.length) {
                        pool.push(...getMovePool());
                    }

                    let move = randomMove(pool, moves);
                    pool.splice(pool.indexOf(move), 1);
                    moves.push(move);
                }
                return moves;
            };

            return getRandomPokemon(
                6,
                (s) => !s.evolves,
                (_, id) => new Pokemon(id, {}, {}, 100, randomMoves())
            );
        },
    },
    randoms: {
        generate() {
            return getRandomPokemon(
                6,
                (s) => !s.evolves,
                (s, id) => {
                    const moves: MoveId[] = [];
                    while (moves.length < 4) {
                        moves.push(randomMove(s.moves, moves));
                    }
                    return new Pokemon(id, {}, {}, 100, moves);
                }
            );
        },
    },
    metronome: {
        generate() {
            return getRandomPokemon(
                6,
                (s) => !s.evolves,
                (_, id) => new Pokemon(id, {}, {}, 100, ["metronome"])
            );
        },
    },
};
