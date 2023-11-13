import type { Status } from "../game/pokemon";
import {
    DamagingMove,
    StatusMove,
    StageMove,
    ConfusionMove,
    AlwaysFailMove,
    RecoveryMove,
    OHKOMove,
    FixedDamageMove,
} from "../game/moves";
import type { ActivePokemon, Stages } from "../game/battle";
import { moveList, type MoveId } from "../game/moveList";
import type { BattleEvent, InfoReason } from "../game/events";
import type { SpeciesId } from "../game/species";
import { hpPercentExact } from "../game/utils";

export type ClientActivePokemon = {
    speciesId: SpeciesId;
    name: string;
    hp: number;
    level: number;
    status: Status | null;
    stats?: ActivePokemon["stats"],
};

export type ClientPlayer = {
    name: string;
    isSpectator: boolean;
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
    atk: "attack",
    def: "defense",
    spc: "special",
    spe: "speed",
    acc: "acccuracy",
    eva: "evasion",
};

const descriptions: Partial<Record<MoveId, string>> = {
    conversion: "Changes the user's types to match the target.",
    disable: "Disables a move from the target's move set at random.",
    haze:
        "Removes the effects of Leech Seed, Mist, Reflect, Light Screen, Focus Energy, and " +
        "Disable, the stat reduction for burn and paralysis, confusion, and all stat stages" +
        "for both the user and the target. Also turns bad poison into regular poison for the " +
        "user, and removes any non-volatile status for the target. ",
    leechseed:
        "Plants a seed on the target. After the target attacks, it will lose 1/16 of their max " +
        "HP, and it will be restored to the user. Ends if the target switches out.",
    metronome: "Selects any move except Struggle for the user to use at random.",
    mirrormove: "Uses the last move targeted at the user by a pokemon still on the field.",
    psywave: "Damages the target for a random amount between 1 HP and 1.5x the user's level. ",
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
        "The user charges on the first turn, and attacks on the second. While charging, the user" +
        "can only be hit by moves that do not check accuracy.",
    multi_turn: "Locks the user in for 3-4 turns. ",
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

        if (move.recoil) {
            buf += `The user takes 1/${move.recoil} the damage dealt due to recoil. `;
        }

        return buf.length ? buf : "No additional effects.";
    } else if (move instanceof FixedDamageMove) {
        if (move.dmg === "level") {
            return "Deals damage equal to the user's level.";
        } else {
            return `Deals ${move.dmg} damage.`;
        }
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
    } else if (move instanceof OHKOMove) {
        return "Deals 65535 damage to the target. Fails on faster opponents. ";
    } else if (id in descriptions) {
        return descriptions[id];
    }
};

export const stringifyEvent = (
    players: Record<string, ClientPlayer>,
    myId: string,
    e: BattleEvent,
    res: string[]
) => {
    const pname = (id: string, title: boolean = true) => {
        if (id === myId) {
            return players[id].active!.name;
        } else if (title) {
            return `The opposing ${players[id].active!.name}`;
        } else {
            return `the opposing ${players[id].active!.name}`;
        }
    };

    if (e.type === "switch") {
        const player = players[e.src];
        if (player.active && player.active.hp) {
            res.push(`${player.name} withdrew ${player.active.name}!`);
        }

        res.push(`${player.name} sent in ${e.name}! (${e.hp}/${e.maxHp})`);
    } else if (e.type === "damage") {
        const src = pname(e.src);
        const target = pname(e.target);

        let { hpBefore, hpAfter } = e;
        if (e.target === myId) {
            hpBefore = hpPercentExact(hpBefore, e.maxHp);
            hpAfter = hpPercentExact(hpAfter, e.maxHp);
        }

        if (e.why === "recoil") {
            res.push(`${src} was hurt by recoil!`);
        } else if (e.why === "drain") {
            res.push(`${src} had it's energy drained!`);
        } else if (e.why === "crash") {
            res.push(`${src} kept going and crashed!`);
        } else if (e.why === "recover") {
            res.push(`${src} regained health!`);
        } else if (e.why === "seeded") {
            res.push(`${src}'s health was sapped by Leech Seed!`);
        } else if (e.why === "psn") {
            res.push(`${src} is hurt by poison!`);
        } else if (e.why === "brn") {
            res.push(`${src} is hurt by its burn!`);
        } else if (e.why === "attacked" && e.isCrit) {
            res.push(`A critical hit!`);
        } else if (e.why === "rest") {
            res.push(`${src} started sleeping!`);
        } else if (e.why === "confusion") {
            res.push("It hurt itself in its confusion!");
        }

        if (e.why !== "explosion") {
            const diff = hpBefore - hpAfter;
            res.push(
                `- ${target} ${diff < 0 ? "gained" : "lost"} ${roundTo(
                    Math.abs(diff),
                    1
                )}% of its health. (${roundTo(hpAfter, 1)}% remaining)`
            );
        }

        if (e.why === "substitute") {
            res.push(`${src} put in a substitute!`);
        } else if (e.why === "attacked") {
            const eff = e.eff ?? 1;
            if (eff !== 1) {
                res.push(` - It's ${eff > 1 ? "super effective!" : "not very effective..."}`);
            }
        } else if (e.why === "ohko") {
            res.push(` - It's a one-hit KO!`);
        }

        if (hpAfter === 0) {
            res.push(`${target} fainted!`);
        }
    } else if (e.type === "failed") {
        const src = pname(e.src);
        switch (e.why) {
            case "immune":
                res.push(`It doesn't affect ${pname(e.src, false)}...`);
                break;
            case "miss":
                res.push(`${src} missed!`);
                break;
            case "cant_substitute":
                res.push(`${src} doesn't have enough HP to create a substitute!`);
                break;
            case "has_substitute":
                res.push(`${src} already has a substitute!`);
                break;
            case "whirlwind":
            case "generic":
                res.push(`But it failed!`);
                break;
            case "flinch":
                res.push(`${src} flinched!`);
                break;
            case "mist":
                res.push(`${src} is protected by the mist!`);
                break;
            case "splash":
                res.push(`No effect!`);
                break;
        }
    } else if (e.type === "move") {
        if (e.thrashing) {
            res.push(`${pname(e.src)}'s thrashing about!`);
        } else if (e.disabled) {
            res.push(`${pname(e.src)}'s ${moveList[e.move].name} is disabled!`);
        } else {
            res.push(`${pname(e.src)} used ${moveList[e.move].name}!`);
        }
    } else if (e.type === "victory") {
        res.push(`${players[e.id].name} wins!`);
    } else if (e.type === "hit_sub") {
        if (e.confusion) {
            res.push("It hurt itself in its confusion!");
        }

        const target = pname(e.target);
        res.push(`${target}'s substitute took the hit!`);
        if (e.broken) {
            res.push(`${target}'s substitute broke!`);
        }

        const eff = e.eff ?? 1;
        if (eff !== 1) {
            res.push(` - It's ${eff > 1 ? "super effective!" : "not very effective..."}`);
        }
    } else if (e.type === "status") {
        const table: Record<Status, string> = {
            psn: "was poisoned",
            par: "was paralyzed",
            slp: "fell asleep",
            frz: "was frozen solid",
            tox: "was badly poisoned",
            brn: "was burned",
        };

        res.push(`${pname(e.id)} ${table[e.status]}!`);
    } else if (e.type === "stages") {
        const name = pname(e.id);
        for (const [stage, amount] of e.stages) {
            res.push(
                `${name}'s ${stageTable[stage]} ${amount > 0 ? "rose" : "fell"}${
                    Math.abs(amount) > 1 ? " sharply" : ""
                }!`
            );
        }
    } else if (e.type === "info") {
        const messages: Record<InfoReason, string> = {
            seeded: "{} was seeded!",
            mist: "{}'s' shrouded in mist!",
            light_screen: "{}'s protected against special attacks!",
            reflect: "{} is gained armor!",
            focus: "{} is getting pumped!",
            conversion: "Converted type to match {l}!",
            payday: "Coins scattered everywhere!",
            became_confused: "{} became confused!",
            confused: "{} is confused!",
            confused_end: "{} snapped out of its confusion!",
            recharge: "{} must recharge!",
            frozen: "{} is frozen solid!",
            sleep: "{} is fast asleep!",
            wake: "{} woke up!",
            haze: "All status changes were removed!",
            thaw: "{} thawed out!",
            paralyze: "{}'s fully paralyzed!",
        };

        res.push(messages[e.why].replace("{}", pname(e.id)).replace("{l}", pname(e.id, false)));
    } else if (e.type === "transform") {
        res.push(`${pname(e.src)} transformed into ${pname(e.target, false)}!`);
    } else if (e.type === "disable") {
        if (e.move) {
            res.push(`${pname(e.id)}'s ${moveList[e.move].name} was disabled!`);
        } else {
            res.push(`${pname(e.id)}'s disabled no longer!`);
        }
    } else if (e.type === "charge") {
        if (e.move === "skullbash") {
            res.push(`${pname(e.id)} lowered its head!`);
        } else if (e.move === "razorwind") {
            res.push(`${pname(e.id)} made a whirlwind!`);
        } else if (e.move === "skyattack") {
            res.push(`${pname(e.id)} is glowing!`);
        } else if (e.move === "solarbeam") {
            res.push(`${pname(e.id)} took in sunlight!`);
        } else if (e.move === "dig") {
            res.push(`${pname(e.id)} dug a hole!`);
        } else if (e.move === "fly") {
            res.push(`${pname(e.id)} flew up high!`);
        }
    } else {
        res.push(JSON.stringify(e));
    }
};