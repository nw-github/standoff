import { Pokemon } from "../game/pokemon";
import { moveList, type MoveId } from "../game/moveList";
import { speciesList, type Species, type SpeciesId } from "../game/species";
import { randChoice } from "../game/utils";
import { AlwaysFailMove, TrappingMove } from "../game/moves";

export const battleFormats = ["truly_randoms", "randoms", "randoms_nfe", "metronome"] as const;

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

const isBadMove = (move: MoveId, moves: MoveId[]) => {
    return (
        moves.includes(move) ||
        move === "struggle" ||
        move === "bide" ||
        move === "counter" ||
        moveList[move] instanceof AlwaysFailMove ||
        moveList[move] instanceof TrappingMove
    );
};

const randoms = (validSpecies: (s: Species, id: SpeciesId) => boolean) => {
    return getRandomPokemon(
        6,
        validSpecies,
        (s, id) => {
            const moves: MoveId[] = [];

            let pool = s.moves;
            const stab = pool.filter(m => {
                const move = moveList[m];
                return (move.power ?? 0) > 40 && s.types.includes(move.type);
            });
            if (stab.length) {
                moves.push(randChoice(stab));
            }

            do {
                pool = pool.filter(move => !isBadMove(move, moves));
                if (!pool.length) {
                    break;
                }
                moves.push(randChoice(pool));
            } while (moves.length < 4);
            return new Pokemon(id, {}, {}, 100, moves);
        }
    );
};

export const formatDescs: Record<FormatId, FormatDesc> = {
    truly_randoms: {
        generate() {
            const pool = getMovePool();
            const randomMove = (moves: MoveId[]) => {
                let move;
                do {
                    move = randChoice(pool);
                } while (isBadMove(move, moves));
                return move;
            };

            const randomMoves = (moves: MoveId[] = [], count: number = 4) => {
                while (moves.length < count) {
                    if (!pool.length) {
                        pool.push(...getMovePool());
                    }

                    const move = randomMove(moves);
                    pool.splice(pool.indexOf(move), 1);
                    moves.push(move);
                }
                return moves;
            };

            return getRandomPokemon(
                6,
                s => !s.evolves,
                (_, id) => new Pokemon(id, {}, {}, 100, randomMoves())
            );
        },
    },
    randoms: {
        generate() {
            return randoms(s => !s.evolves);
        },
    },
    randoms_nfe: {
        generate() {
            return randoms((s, id) => s.evolves && id !== "weedle" && id !== "metapod");
        },
    },
    metronome: {
        generate() {
            return getRandomPokemon(
                6,
                s => !s.evolves,
                (_, id) => new Pokemon(id, {}, {}, 100, ["metronome"])
            );
        },
    },
};
