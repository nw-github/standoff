import { Pokemon } from "../game/pokemon";
import { moveList, type MoveId } from "../game/moveList";
import { speciesList, type Species, type SpeciesId } from "../game/species";
import { AlwaysFailMove, Move } from "../game/moves";
import random from "random";

export const battleFormats = [
  "standard",
  "nfe",
  "randoms",
  "randoms_nfe",
  "truly_randoms",
  "metronome",
] as const;

export type FormatId = (typeof battleFormats)[number];

export type TeamProblems = (string | { source: string; problems: string[] })[];

type FormatDesc = {
  generate?(): Pokemon[];
  validate?(team: string): readonly [true, Pokemon[]] | readonly [false, TeamProblems];
};

const speciesIds = Object.keys(speciesList) as SpeciesId[];

const badMoves = new Set<MoveId>(["struggle", "focusenergy", "payday", "absorb", "focusenergy"]);

const uselessNfe = new Set<SpeciesId>(["weedle", "metapod", "kakuna", "magikarp", "caterpie"]);

const getRandomPokemon = (
  count: number,
  validSpecies: (s: Species, id: SpeciesId) => boolean,
  customize: (s: Species, id: SpeciesId) => Pokemon,
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
  validMove: (m: Move, id: MoveId) => boolean,
) => {
  return moves
    .filter(id => validMove(moveList[id], id))
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
};

const isBadMove = (move: Move, id: MoveId) => {
  return badMoves.has(id) || move instanceof AlwaysFailMove;
};

const randoms = (validSpecies: (s: Species, id: SpeciesId) => boolean, level = 100) => {
  return getRandomPokemon(6, validSpecies, (s, id) => {
    const moves = getRandomMoves(4, s.moves, (move, id) => !isBadMove(move, id));
    const stab = s.moves.filter(m => {
      const move = moveList[m];
      return (move.power ?? 0) > 40 && s.types.includes(move.type) && !moves.includes(m);
    });
    if (stab.length) {
      moves[0] = random.choice(stab)!;
    }
    return new Pokemon(id, {}, {}, level, moves);
  });
};

const validateTeam = (text: string, onPoke?: (poke: Pokemon, problems: TeamProblems) => void) => {
  const problems: TeamProblems = [];
  const team = text
    .split("\n\n")
    .map(poke => poke.trim())
    .filter(poke => poke.length);
  if (team.length < 1 || team.length > 6) {
    problems.push("Team must have between 1 and 6 pokemon");
  }

  const result = [];
  for (const text of team) {
    const poke = Pokemon.fromString(text);
    if (!(poke instanceof Pokemon)) {
      problems.push({ source: text, problems: poke });
      continue;
    }

    const myProblems: string[] = [];
    if (onPoke) {
      onPoke(poke, myProblems);
    }

    for (const move of poke.moves) {
      if (!(poke.species.moves as MoveId[]).includes(move)) {
        myProblems.push(`${poke.species.name} does not learn ${moveList[move].name}`);
      }
    }

    if (!poke.moves.length) {
      myProblems.push(`${poke.species.name} must have at least one move`);
    }

    if (poke.level < 1 || poke.level > 100) {
      myProblems.push(`${poke.species.name} must have a level between 1 and 100`);
    }

    if (myProblems.length) {
      problems.push({ source: text, problems: myProblems });
    }
    result.push(poke);
  }

  if (problems.length) {
    return [false, problems] as const;
  } else {
    return [true, result] as const;
  }
};

export const formatDescs: Record<FormatId, FormatDesc> = {
  standard: {
    validate(text) {
      return validateTeam(text);
    },
  },
  nfe: {
    validate(text) {
      return validateTeam(text, (poke, problems) => {
        if (!poke.species.evolves) {
          problems.push(`'${poke.species.name}' cannot be used in NFE format (it does not evolve)`);
        }
      });
    },
  },
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
              (move, id) => !isBadMove(move, id),
            ),
          ),
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
        (_, id) => new Pokemon(id, {}, {}, 100, ["metronome"]),
      );
    },
  },
};
