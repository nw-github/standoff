import {
    Move,
    BooleanFlagMove,
    ConfusionMove,
    DamagingMove,
    FixedDamageMove,
    OHKOMove,
    AlwaysFailMove,
    RecoveryMove,
    StageMove,
    StatusMove,
    UniqueMove,
} from "./moves";
import { TransformedPokemon } from "./transformed";
import { checkAccuracy, randChoice, randRangeInclusive } from "./utils";

export type MoveId = keyof typeof moveList;

export const moveList = {
    amnesia: new StageMove({
        name: "Amnesia",
        pp: 20,
        type: "psychic",
        stages: [["spc", 2]],
    }),
    bodyslam: new DamagingMove({
        name: "Body Slam",
        pp: 15,
        type: "normal",
        power: 85,
        acc: 100,
        effect: [30.1, "par"],
    }),
    confuseray: new ConfusionMove({
        name: "Confuse Ray",
        pp: 10,
        type: "ghost",
        acc: 100,
    }),
    conversion: new UniqueMove({
        name: "Conversion",
        pp: 30,
        type: "normal",
        execute(battle, user, target) {
            user.types.length = 0;
            user.types.push(...target.types);

            battle.pushEvent({
                type: "info",
                id: target.owner.id,
                why: "conversion",
            });

            return false;
        },
    }),
    crabhammer: new DamagingMove({
        name: "Crabhammer",
        pp: 10,
        type: "water",
        power: 90,
        acc: 85,
        flag: "high_crit",
    }),
    dig: new DamagingMove({
        name: "Dig",
        pp: 10,
        type: "ground",
        power: 100,
        acc: 100,
        flag: "charge_invuln",
    }),
    disable: new UniqueMove({
        name: "Disable",
        pp: 20,
        type: "normal",
        acc: 55,
        execute(battle, user, target) {
            const choices = target.base.moves.filter((_, i) => target.base.pp[i] !== 0);
            if (!choices.length || target.disabled) {
                battle.pushEvent({
                    type: "failed",
                    src: target.owner.id,
                    why: "generic",
                });
                return false;
            }

            if (!checkAccuracy(this.acc!, battle, user, target)) {
                return false;
            }

            const move = randChoice(choices);
            target.disabled = { move: moveList[move], turns: randRangeInclusive(1, 8) };
            battle.pushEvent({
                type: "disable",
                id: target.owner.id,
                move,
            });

            return false;
        },
    }),
    doubleedge: new DamagingMove({
        name: "Double Edge",
        pp: 15,
        type: "normal",
        power: 100,
        acc: 100,
        recoil: 4, // 1 / 4
    }),
    doublekick: new DamagingMove({
        name: "Double Kick",
        pp: 30,
        type: "fight",
        power: 30,
        acc: 100,
        flag: "double",
    }),
    dragonrage: new FixedDamageMove({
        name: "Dragon Rage",
        pp: 10,
        type: "dragon",
        acc: 100,
        dmg: 40,
    }),
    dreameater: new DamagingMove({
        name: "Dream Eater",
        pp: 15,
        type: "psychic",
        power: 100,
        acc: 100,
        flag: "dream_eater",
    }),
    earthquake: new DamagingMove({
        name: "Earthquake",
        pp: 10,
        type: "ground",
        power: 100,
        acc: 100,
    }),
    explosion: new DamagingMove({
        name: "Explosion",
        pp: 5,
        type: "normal",
        power: 170,
        acc: 100,
        flag: "explosion",
    }),
    fissure: new OHKOMove({
        name: "Fissure",
        pp: 5,
        type: "ground",
        acc: 30,
    }),
    fly: new DamagingMove({
        name: "Fly",
        pp: 15,
        type: "flying",
        power: 70,
        acc: 95,
        flag: "charge_invuln",
    }),
    focusenergy: new BooleanFlagMove({
        name: "Focus Energy",
        pp: 30,
        type: "normal",
        flag: "focus",
    }),
    guillotine: new OHKOMove({
        name: "Guillotine",
        pp: 5,
        type: "normal",
        acc: 30,
    }),
    headbutt: new DamagingMove({
        name: "Headbutt",
        pp: 15,
        type: "normal",
        power: 70,
        acc: 100,
        effect: [30.1, "flinch"],
    }),
    hijumpkick: new DamagingMove({
        name: "Hi Jump Kick",
        pp: 20,
        type: "fight",
        power: 85,
        acc: 90,
        flag: "crash",
    }),
    horndrill: new OHKOMove({
        name: "Horn Drill",
        pp: 5,
        type: "normal",
        acc: 30,
    }),
    hyperbeam: new DamagingMove({
        name: "Hyper Beam",
        pp: 5,
        type: "normal",
        power: 150,
        acc: 90,
        flag: "recharge",
    }),
    jumpkick: new DamagingMove({
        name: "Jump Kick",
        pp: 25,
        type: "fight",
        power: 70,
        acc: 95,
        flag: "crash",
    }),
    leechseed: new UniqueMove({
        name: "Leech Seed",
        pp: 15,
        type: "grass",
        acc: 80,
        execute(battle, user, target) {
            if (target.types.includes(this.type)) {
                battle.pushEvent({
                    type: "failed",
                    src: target.owner.id,
                    why: "immune",
                });
                return false;
            }

            if (!checkAccuracy(this.acc!, battle, user, target)) {
                return false;
            }

            target.seeded = true;
            battle.pushEvent({
                type: "info",
                id: target.owner.id,
                why: "seeded",
            });
            return false;
        },
    }),
    lightscreen: new BooleanFlagMove({
        name: "Light Screen",
        pp: 30,
        type: "psychic",
        flag: "light_screen",
    }),
    megadrain: new DamagingMove({
        name: "Mega Drain",
        pp: 10,
        type: "grass",
        power: 40,
        acc: 100,
        flag: "drain",
    }),
    metronome: new UniqueMove({
        name: "Metronome",
        pp: 10,
        type: "normal",
        execute(battle, user, target): boolean {
            const moves: Move[] = Object.values(moveList);

            let move;
            do {
                move = randChoice(moves);
            } while (move === this || move === moveList.struggle);

            return move.use(battle, user, target, -1);
        },
    }),
    minimize: new StageMove({
        name: "Minimize",
        pp: 15,
        type: "normal",
        stages: [["eva", +1]],
    }),
    mirrormove: new UniqueMove({
        name: "Mirror Move",
        pp: 20,
        type: "flying",
        execute(battle, user, target) {
            if (!target.lastMove || target.lastMove === this) {
                battle.pushEvent({
                    type: "failed",
                    src: user.owner.id,
                    why: "generic",
                });
                return false;
            }

            return target.lastMove.use(battle, user, target, -1);
        },
    }),
    mist: new BooleanFlagMove({
        name: "Mist",
        pp: 30,
        type: "ice",
        flag: "mist",
    }),
    nightshade: new FixedDamageMove({
        name: "Night Shade",
        pp: 15,
        type: "ghost",
        acc: 100,
        dmg: "level",
    }),
    payday: new DamagingMove({
        name: "Pay Day",
        pp: 20,
        type: "normal",
        power: 40,
        acc: 100,
        flag: "payday",
    }),
    petaldance: new DamagingMove({
        name: "Petal Dance",
        pp: 20,
        type: "grass",
        power: 70,
        acc: 100,
        flag: "multi_turn",
    }),
    pinmissile: new DamagingMove({
        name: "Pin Missile",
        pp: 20,
        type: "bug",
        power: 14,
        acc: 85,
        flag: "multi",
    }),
    psybeam: new DamagingMove({
        name: "Psybeam",
        pp: 20,
        type: "psychic",
        power: 65,
        acc: 100,
        effect: [10.2, "confusion"],
    }),
    psychic: new DamagingMove({
        name: "Psychic",
        pp: 10,
        type: "psychic",
        power: 90,
        acc: 100,
        effect: [33.2, [["spc", -1]]],
    }),
    psywave: new UniqueMove({
        name: "Psywave",
        pp: 15,
        type: "psychic",
        acc: 80,
        execute(battle, user, target) {
            if (!checkAccuracy(this.acc!, battle, user, target)) {
                return false;
            }

            // psywave has a desync glitch that we don't emulate
            return target.inflictDamage(
                randRangeInclusive(1, Math.max(Math.floor(user.base.level * 1.5 - 1), 1)),
                user,
                battle,
                false,
                "attacked"
            ).dead;
        },
    }),
    quickattack: new DamagingMove({
        name: "Quick Attack",
        pp: 30,
        type: "normal",
        power: 40,
        acc: 100,
        priority: +1,
    }),
    razorwind: new DamagingMove({
        name: "Razor Wind",
        pp: 10,
        type: "normal",
        power: 80,
        acc: 75,
        flag: "charge",
    }),
    recover: new RecoveryMove({
        name: "Recover",
        pp: 20,
        type: "normal",
        why: "recover",
    }),
    reflect: new BooleanFlagMove({
        name: "Reflect",
        pp: 20,
        type: "psychic",
        flag: "reflect",
    }),
    roar: new AlwaysFailMove({
        name: "Roar",
        pp: 20,
        acc: 100,
        type: "normal",
        why: "whirlwind",
    }),
    sandattack: new StageMove({
        name: "Sand Attack",
        pp: 15,
        type: "normal",
        stages: [["acc", -1]],
        acc: 100,
    }),
    seismictoss: new FixedDamageMove({
        name: "Seismic Toss",
        pp: 20,
        type: "normal",
        acc: 100,
        dmg: "level",
    }),
    selfdestruct: new DamagingMove({
        name: "Self-Destruct",
        pp: 5,
        type: "normal",
        power: 130,
        acc: 100,
        flag: "explosion",
    }),
    skullbash: new DamagingMove({
        name: "Skull Bash",
        pp: 15,
        type: "normal",
        power: 100,
        acc: 100,
        flag: "charge",
    }),
    skyattack: new DamagingMove({
        name: "Sky Attack",
        pp: 5,
        type: "flying",
        power: 140,
        acc: 90,
        flag: "charge",
    }),
    softboiled: new RecoveryMove({
        name: "Softboiled",
        pp: 10,
        type: "normal",
        why: "recover",
    }),
    solarbeam: new DamagingMove({
        name: "SolarBeam",
        pp: 10,
        type: "grass",
        power: 120,
        acc: 100,
        flag: "charge",
    }),
    sonicboom: new FixedDamageMove({
        name: "Sonic Boom",
        pp: 20,
        type: "normal",
        acc: 90,
        dmg: 20,
    }),
    splash: new AlwaysFailMove({
        name: "Splash",
        pp: 40,
        type: "normal",
        why: "splash",
    }),
    spore: new StatusMove({
        name: "Spore",
        pp: 15,
        type: "grass",
        acc: 100,
        status: "slp",
    }),
    struggle: new DamagingMove({
        name: "Struggle",
        pp: 10,
        type: "normal",
        acc: 100,
        power: 50,
        recoil: 2,
    }),
    substitute: new UniqueMove({
        name: "Substitute",
        pp: 10,
        type: "normal",
        execute(battle, user, _) {
            if (user.substitute > 0) {
                battle.pushEvent({
                    type: "failed",
                    src: user.owner.id,
                    why: "has_substitute",
                });
                return false;
            }

            const hp = Math.floor(user.base.stats.hp / 4);
            // Gen 1 bug, if you have exactly 25% hp you can create a substitute and instantly die
            if (hp > user.base.hp) {
                battle.pushEvent({
                    type: "failed",
                    src: user.owner.id,
                    why: "cant_substitute",
                });
                return false;
            }

            const { dead } = user.inflictDamage(hp, user, battle, false, "substitute");
            user.substitute = hp + 1;
            return dead;
        },
    }),
    superfang: new UniqueMove({
        name: "Super Fang",
        pp: 10,
        type: "normal",
        acc: 90,
        execute(battle, user, target) {
            if (!checkAccuracy(this.acc!, battle, user, target)) {
                return false;
            }

            return target.inflictDamage(
                Math.max(Math.floor(target.base.hp / 2), 1),
                user,
                battle,
                false,
                "attacked"
            ).dead;
        },
    }),
    supersonic: new ConfusionMove({
        name: "Supersonic",
        pp: 20,
        type: "normal",
        acc: 55,
    }),
    teleport: new AlwaysFailMove({
        name: "Teleport",
        pp: 20,
        type: "psychic",
        why: "generic",
    }),
    thrash: new DamagingMove({
        name: "Thrash",
        pp: 20,
        type: "normal",
        power: 90,
        acc: 100,
        flag: "multi_turn",
    }),
    toxic: new StatusMove({
        name: "Toxic",
        pp: 15,
        type: "poison",
        acc: 85,
        status: "tox",
    }),
    transform: new UniqueMove({
        name: "Transform",
        pp: 10,
        type: "normal",
        execute(battle, user, target) {
            if (user.base instanceof TransformedPokemon) {
                user.base = new TransformedPokemon(user.base.base, target.base);
            } else {
                user.base = new TransformedPokemon(user.base, target.base);
            }

            for (const k in user.stages) {
                // @ts-ignore
                user.stages[k] = target.stages[k];
            }

            user.types.length = 0;
            user.types.push(...target.types);

            battle.pushEvent({
                type: "transform",
                src: user.owner.id,
                target: target.owner.id,
            });
            return false;
        },
    }),
    twineedle: new DamagingMove({
        name: "Twineedle",
        pp: 20,
        type: "bug",
        power: 25,
        acc: 100,
        flag: "double",
        effect: [20, "psn"],
    }),
    whirlwind: new AlwaysFailMove({
        name: "Whirlwind",
        pp: 20,
        acc: 100,
        type: "normal",
        why: "whirlwind",
    }),
};

export const moveListToId = (() => {
    const rev = new Map<Move, MoveId>();
    for (const k in moveList) {
        // @ts-ignore
        rev.set(moveList[k], k);
    }
    return rev;
})();
