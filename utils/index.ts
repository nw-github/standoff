import type { Status } from "../game/pokemon";
import {
    DamagingMove,
    StatusMove,
    StageMove,
    ConfusionMove,
    AlwaysFailMove,
    RecoveryMove,
} from "../game/moves";
import type { ActivePokemon, VolatileStats } from "../game/battle";
import { moveList, type MoveId } from "../game/moveList";
import type { SpeciesId } from "../game/species";
import type { Stages, Type } from "../game/utils";

export type ClientActivePokemon = {
    speciesId: SpeciesId;
    name: string;
    hp: number;
    level: number;
    stages: Partial<Record<Stages, number>>;
    status?: Status;
    stats?: VolatileStats;
    transformed?: SpeciesId;
    conversion?: Type[];
};

export type ClientPlayer = {
    name: string;
    isSpectator: boolean;
    connected: boolean;
    active?: ClientActivePokemon;
};

export const toTitleCase = (s: string) => {
    return s.slice(0, 1).toUpperCase() + s.slice(1);
};

export const roundTo = (num: number, places: number = 1) => {
    const pow = 10 ** places;
    return Math.round(num * pow) / pow;
};

const dmgStatusTable: Record<Status, string> = {
    brn: "burn the target. ",
    par: "paralyze the target. ",
    frz: "freeze the target. ",
    psn: "poison the target. ",
    tox: "badly poison the target. ",
    slp: "put the target to sleep. ",
};

const statusTable: Record<Status, string> = {
    brn: "Burns the target",
    par: "Paralyzes the target",
    frz: "Freezes the target",
    psn: "Poisons the target",
    tox: "Badly poisons the target",
    slp: "Puts the target to sleep",
};

export const stageTable: Record<Stages, string> = {
    atk: "Attack",
    def: "Defense",
    spc: "Special",
    spe: "Speed",
    acc: "Acccuracy",
    eva: "Evasion",
};

const descriptions: Partial<Record<MoveId, string>> = {
    conversion: "Changes the user's types to match the target.",
    disable: "Disables a move from the target's move set at random.",
    haze:
        "Removes the effects of Leech Seed, Mist, Reflect, Light Screen, Focus Energy, and " +
        "Disable, the stat reduction for burn and paralysis, confusion, and all stat stages " +
        "for both the user and the target. Also turns bad poison into regular poison for the " +
        "user, and removes any non-volatile status for the target. ",
    leechseed:
        "Plants a seed on the target. After the target attacks, it will lose 1/16 of their max " +
        "HP, and it will be restored to the user. Ends if the target switches out.",
    metronome: "Selects any move except Struggle for the user to use at random.",
    mirrormove: "Uses the last move targeted at the user by a pokemon still on the field.",
    substitute:
        "The user sacrifices 1/4 its HP to create a substitute with 1/4 its HP + 1. The " +
        "substitute protects it from status and stat stage changes from the opponent's attacks, " +
        "excluding Leech Seed, Disable, direct sleep or paralysis, and indirect confusion. ",
    superfang: "Damages the target for 1/2 its current HP.",
    transform: "Copies the target's stats, species, moves, and types. Each move is given 5 PP.",
    focusenergy: "Quarters the user's critical hit rate.",
    lightscreen: "Halves damage dealt by special attacks. Ends on switch out.",
    reflect: "Halves damage dealt by physical attacks. Ends on switch out.",
    mist: "Protects the user from stat dropping moves. Ends on switch out.",
    bide:
        "The user sits dormant for 2-3 turns, damaging the opponent for 2x the damage received " +
        "during the idling period. ",
};

const flagDesc: Record<NonNullable<DamagingMove["flag"]>, string> = {
    drain: "The user recovers 1/2 the damage dealt. ",
    explosion: "Causes the user to faint. ",
    crash: "If the user misses this move, it will take 1 HP due to crash damage. ",
    multi: "Hits 2-5 times. ",
    high_crit: "Has a high critical hit ratio. ",
    recharge: "After using this move, the user must spend one turn to recharge. ",
    double: "Hits twice. ",
    dream_eater: "The user recovers 1/2 the damage dealt. Only works on sleeping targets. ",
    payday: "",
    charge: "The user charges on the first turn, and attacks on the second. ",
    charge_invuln:
        "The user charges on the first turn, and attacks on the second. While charging, the user " +
        "can only be hit by moves that do not check accuracy.",
    multi_turn: "Locks the user in for 3-4 turns. Afterwards, the user becomes confused.",
    rage:
        "After using this move, the user will not be able to switch or do anything else except " +
        "continue to use Rage until it faints or the battle ends. Every time it is hit by a move " +
        "or targeted by Disable, Explosion, or Self-Destruct, it's attack will increase by one " +
        "stage. ",
    level: "Deals damage equal to the user's level.",
    ohko: "Deals 65535 damage to the target. Fails on faster opponents. ",
    trap: "Deals damage and prevents the target from moving for 2-5 turns. ",
    counter: "Deals 2x the last move's damage if it was normal or fighting type. ",
    super_fang: "Deals damage equal to 1/2 the target's current HP. ",
    psywave: "Damages the target for a random amount between 1 HP and 1.5x the user's level. ",
};

export const formatNames: Record<FormatId, string> = {
    randoms: "Random Battle",
    metronome: "Metronome Battle",
    truly_randoms: "Truly Random Battle",
    randoms_nfe: "Random Battle (NFE)",
};

export const describeMove = (id: MoveId) => {
    const move = moveList[id];
    if (move instanceof DamagingMove) {
        let buf = move.flag && move.flag in flagDesc ? flagDesc[move.flag] : "";
        if (move.effect) {
            const [chance, effect] = move.effect;
            buf += `Has a ${chance}% chance to `;
            if (Array.isArray(effect)) {
                const [stat, count] = effect[0];
                buf += `drop ${stageTable[stat]} by ${Math.abs(count)} stage(s). `;
            } else if (effect === "confusion") {
                buf += "confuse the target. ";
            } else if (effect === "flinch") {
                buf += "flinch the target. ";
            } else {
                buf += dmgStatusTable[effect];
            }
        }

        if (move.dmg) {
            buf += `Deals ${move.dmg} damage. `;
        }

        if (move.recoil) {
            buf += `The user takes 1/${move.recoil} the damage dealt due to recoil. `;
        }

        return buf.length ? buf : "No additional effects.";
    } else if (move instanceof StatusMove) {
        return statusTable[move.status] + ". ";
    } else if (move instanceof StageMove) {
        const [stat, count] = move.stages[0];
        const target = move.acc ? "target" : "user";
        const raise = count < 0 ? "Drops" : "Raises";
        return `${raise} the ${target}'s ${stageTable[stat]} by ${Math.abs(count)} stage(s). `;
    } else if (move instanceof ConfusionMove) {
        return "Confuses the target. ";
    } else if (move instanceof AlwaysFailMove) {
        return "Has no effect. ";
    } else if (move instanceof RecoveryMove) {
        if (move.why === "rest") {
            return "The user goes to sleep for two turns, recovering HP and curing status conditions. ";
        } else {
            return "The user recovers 1/2 its max HP. ";
        }
    } else if (id in descriptions) {
        return descriptions[id];
    }
};
