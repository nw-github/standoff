<template>
    <div class="textbox">
        <template v-for="(turn, i) in turns">
            <div class="turn">
                <h2>Turn {{ i + 1 }}</h2>
            </div>
            <div v-html="turn"></div>
        </template>

        <div ref="textboxScrollDiv"></div>
    </div>
</template>

<style scoped>
.textbox {
    overflow-y: auto;
    background-color: #ccc;
}

.textbox > div {
    padding: 0px 5px;
}

.turn {
    background-color: #aaa;
}
</style>

<style>
.textbox h3,
h4,
h5,
h6 {
    font-weight: normal;
}

.textbox .red {
    color: var(--stat-down);
}

.textbox .green {
    color: green;
}
</style>

<script setup lang="ts">
import type { Status } from "../game/pokemon";
import type { BattleEvent, InfoReason } from "../game/events";
import { moveList } from "../game/moveList";
import { hpPercentExact } from "../game/utils";
import { stageTable } from "#imports";
import DOMPurify from "dompurify";
import { marked } from "marked";
import "assets/colors.css";

const textboxScrollDiv = ref<HTMLDivElement | null>(null);
const turns = ref<string[]>([]);

const props = defineProps<{
    players: Record<string, ClientPlayer>;
    myId: string;
    perspective: string;
}>();

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const enterTurn = async (events: BattleEvent[], live: boolean, cb: (e: BattleEvent) => void) => {
    turns.value.push("");
    for (const e of events) {
        turns.value[turns.value.length - 1] += htmlForEvent(e);
        cb(e);

        if (live) {
            await nextTick();
            textboxScrollDiv.value?.scrollIntoView();
            await delay(300);
        }
    }

    if (!live) {
        await nextTick();
        textboxScrollDiv.value?.scrollIntoView();
    }
};

const htmlForEvent = (e: BattleEvent) => {
    const players = props.players;
    const pname = (id: string, title: boolean = true) => {
        if (id === props.perspective) {
            return players[id].active!.name;
        } else if (title) {
            return `The opposing ${players[id].active!.name}`;
        } else {
            return `the opposing ${players[id].active!.name}`;
        }
    };

    const res = [];
    if (e.type === "switch") {
        const player = players[e.src];
        if (player.active && player.active.hp) {
            if (e.src === props.perspective) {
                res.push(`Come back! ${player.active.name}!`);
            } else {
                res.push(`${player.name} withdrew ${player.active.name}!`);
            }
        }

        if (e.src === props.perspective) {
            res.push(`Go! **${e.name}**!`);
        } else {
            res.push(`${player.name} sent in **${e.name}**!`);
        }
    } else if (e.type === "damage" || e.type === "recover") {
        const src = pname(e.src);
        const target = pname(e.target);
        const percent = roundTo(Math.abs(hpPercentExact(e.hpBefore - e.hpAfter, e.maxHp)), 1);
        if (e.type === "damage") {
            const effMsg = `*It's ${
                (e.eff ?? 1) > 1 ? "super effective!" : "not very effective..."
            }*`;
            if (e.why === "recoil") {
                res.push(`${src} was hurt by recoil!`);
            } else if (e.why === "crash") {
                res.push(`${src} kept going and crashed!`);
            } else if (e.why === "seeded") {
                res.push(`${src}'s health was sapped by Leech Seed!`);
            } else if (e.why === "psn") {
                res.push(`${src} is hurt by poison!`);
            } else if (e.why === "brn") {
                res.push(`${src} is hurt by its burn!`);
            } else if (e.why === "attacked" && e.isCrit) {
                res.push("A critical hit!");
            } else if (e.why === "confusion") {
                res.push("It hurt itself in its confusion!");
            } else if (e.why === "attacked" && e.hitCount === undefined && (e.eff ?? 1) !== 1) {
                res.push(effMsg);
            } else if (e.why === "ohko") {
                res.push("It's a one-hit KO!");
            }

            if (e.why !== "explosion") {
                res.push(
                    `##### <span class="red">${target} lost ${percent}% of its health!</span>`
                );
            }

            if (e.why === "substitute") {
                res.push(`${src} put in a substitute!`);
            }

            if ((e.hitCount ?? 0) > 0) {
                if (e.eff !== 1) {
                    res.push(effMsg);
                }
                res.push(`Hit ${e.hitCount} time(s)!`);
            }

            if (e.hpAfter === 0) {
                res.push(`${target} fainted!`);
            }
        } else {
            if (e.why === "drain") {
                res.push(`${src} had it's energy drained!`);
            } else if (e.why === "recover") {
                res.push(`${src} regained health!`);
            } else if (e.why === "rest") {
                res.push(`${src} started sleeping!`);
            }

            res.push(
                `##### <span class="green">${target} gained ${percent}% of its health.</span>`
            );
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
        if (e.thrashing && e.move !== "rage") {
            res.push(`${pname(e.src)}'s thrashing about!`);
        } else if (e.disabled) {
            res.push(`${pname(e.src)}'s ${moveList[e.move].name} is disabled!`);
        } else {
            res.push(`${pname(e.src)} used **${moveList[e.move].name}**!`);
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
            confused_end: "{}'s confused no more!",
            recharge: "{} must recharge!",
            frozen: "{} is frozen solid!",
            sleep: "{} is fast asleep!",
            wake: "{} woke up!",
            haze: "All status changes were removed!",
            thaw: "{} thawed out!",
            paralyze: "{}'s fully paralyzed!",
            rage: "{}'s rage is building!",
        };

        res.push(messages[e.why].replace("{}", pname(e.id)).replace("{l}", pname(e.id, false)));
    } else if (e.type === "transform") {
        res.push(`${pname(e.src)} transformed into ${pname(e.target, false)}!`);
    } else if (e.type === "disable") {
        if (e.move) {
            res.push(`${pname(e.id)}'s ${moveList[e.move].name} was disabled!`);
        } else {
            res.push(`${pname(e.id)}'s disabled no more!`);
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
    } else if (e.type === "mimic") {
        res.push(`${pname(e.id)} learned ${moveList[e.move].name}!`);
    } else {
        res.push(JSON.stringify(e));
    }

    return DOMPurify.sanitize(res.reduce((acc, x) => acc + `<div>${marked(x)}</div>`, ""));
};

const clear = () => {
    turns.value.length = 0;
};

defineExpose({ enterTurn, clear });
</script>
