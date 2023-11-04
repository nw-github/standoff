import { type Species, Pokemon } from "./pokemon";
import { mewtwo } from "./species";

describe("mewtwo stats", () => {
    test("level 100", () => {
        const res = new Pokemon(mewtwo, {}, {}, 100, []);
        expect(res.stats).toEqual({
            hp: 322,
            atk: 225,
            def: 185,
            spc: 313,
            spe: 265,
        });
    });

    test("level 100 - max dv", () => {
        const res = new Pokemon(mewtwo, { atk: 15, def: 15, spc: 15, spe: 15 }, {}, 100, []);
        expect(res.stats).toEqual({
            hp: 352,
            atk: 255,
            def: 215,
            spc: 343,
            spe: 295,
        });
    });

    test("level 100 - max statexp", () => {
        const res = new Pokemon(
            mewtwo,
            {},
            { hp: 65535, atk: 65535, def: 65535, spc: 65535, spe: 65535 },
            100,
            [],
        );
        expect(res.stats).toEqual({
            hp: 385,
            atk: 288,
            def: 248,
            spc: 376,
            spe: 328,
        });
    });

    test("level 100 - max dv + statexp", () => {
        const res = new Pokemon(
            mewtwo,
            { atk: 15, def: 15, spc: 15, spe: 15 },
            { hp: 65535, atk: 65535, def: 65535, spc: 65535, spe: 65535 },
            100,
            [],
        );
        expect(res.stats).toEqual({
            hp: 415,
            atk: 318,
            def: 278,
            spc: 406,
            spe: 358,
        });
    });
});
