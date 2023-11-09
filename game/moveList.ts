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
    ConversionMove,
    Psywave,
    Substitute,
    MirrorMove,
    Metronome
} from "./moves";

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
    conversion: new ConversionMove(),
    crabhammer: new DamagingMove({
        name: "Crabhammer",
        pp: 10,
        type: "water",
        power: 90,
        acc: 85,
        flag: "high_crit",
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
    metronome: new Metronome(),
    minimize: new StageMove({
        name: "Minimize",
        pp: 15,
        type: "normal",
        stages: [["eva", +1]],
    }),
    mirrormove: new MirrorMove(),
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
    psywave: new Psywave(),
    quickattack: new DamagingMove({
        name: "Quick Attack",
        pp: 30,
        type: "normal",
        power: 40,
        acc: 100,
        priority: +1,
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
    softboiled: new RecoveryMove({
        name: "Softboiled",
        pp: 10,
        type: "normal",
        why: "recover",
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
    substitute: new Substitute(),
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