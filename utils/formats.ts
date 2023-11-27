import { Pokemon } from "../game/pokemon";
import { moveList, type MoveId } from "../game/moveList";
import { speciesList, type Species, type SpeciesId } from "../game/species";
import { randChoice } from "../game/utils";
import { AlwaysFailMove, Move } from "../game/moves";

export const battleFormats = ["truly_randoms", "randoms", "randoms_nfe", "metronome"] as const;

export type FormatId = (typeof battleFormats)[number];

type FormatDesc = {
    generate?(): Pokemon[];
    validate?(team: Pokemon[]): string | undefined;
};

const speciesIds = Object.keys(speciesList) as SpeciesId[];

const getRandomPokemon = (
    count: number,
    validSpecies: (s: Species, id: SpeciesId) => boolean,
    customize: (s: Species, id: SpeciesId) => Pokemon
) => {
    return speciesIds
        .filter(id => validSpecies(speciesList[id], id))
        .sort(() => Math.random() - 0.5)
        .slice(0, count)
        .map(id => customize(speciesList[id], id));
};

const getRandomMoves = (
    count: number,
    moves: MoveId[],
    validMove: (m: Move, id: MoveId) => boolean
) => {
    return moves
        .filter(id => validMove(moveList[id], id))
        .sort(() => Math.random() - 0.5)
        .slice(0, count);
};

const badMoves = new Set<MoveId>([
    "struggle",
    "bide",
    "focusenergy",
    "payday",
    "absorb",
    "focusenergy",
]);

const uselessNfe = new Set<SpeciesId>(["weedle", "metapod", "kakuna", "magikarp", "caterpie"]);

const isBadMove = (move: Move, id: MoveId) => {
    return badMoves.has(id) || move instanceof AlwaysFailMove || (move as any).flag === "trap";
};

const randoms = (validSpecies: (s: Species, id: SpeciesId) => boolean) => {
    return getRandomPokemon(6, validSpecies, (s, id) => {
        const moves = getRandomMoves(4, s.moves, (move, id) => !isBadMove(move, id));
        const stab = s.moves.filter(m => {
            const move = moveList[m];
            return (move.power ?? 0) > 40 && s.types.includes(move.type) && !moves.includes(m);
        });
        if (stab.length) {
            moves[0] = randChoice(stab);
        }
        return new Pokemon(id, {}, {}, 100, moves);
    });
};

export const formatDescs: Record<FormatId, FormatDesc> = {
    truly_randoms: {
        generate() {
            return getRandomPokemon(
                6,
                s => !s.evolves,
                (_, id) =>
                    new Pokemon(
                        id,
                        {},
                        {},
                        100,
                        getRandomMoves(
                            4,
                            Object.keys(moveList) as MoveId[],
                            (move, id) => !isBadMove(move, id)
                        )
                    )
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
            return randoms((s, id) => s.evolves && !uselessNfe.has(id));
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
