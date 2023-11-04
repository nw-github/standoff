import { EventSystem, type Turn } from "./event";
import { type Move } from "./move";
import { type Pokemon, type Type } from "./pokemon";
import { randChance255, stageMultipliers } from "./utils";

export type Choice =
    | { type: "switch"; turn: number; to: number }
    | { type: "move"; turn: number; index: number };

type ChosenMove = {
    move: Move;
    user: ActivePokemon;
    target: ActivePokemon;
};

export class Player {
    readonly active: ActivePokemon;
    readonly name: string;
    readonly team: Pokemon[];
    choice: ChosenMove | null = null;

    constructor(name: string, team: Pokemon[]) {
        this.active = new ActivePokemon(team[0], this);
        this.team = team;
        this.name = name;
    }
}

export class Battle {
    private readonly players: [Player, Player];
    private turn = 0;
    readonly events: EventSystem = new EventSystem();
    victor: Player | null = null;

    private constructor(player1: Player, player2: Player) {
        this.players = [player1, player2];
    }

    static start(player1: Player, player2: Player): [Battle, Turn] {
        const self = new Battle(player1, player2);

        // TODO: is the initial switch order determined by speed?
        for (const player of self.players) {
            player.active.switchTo(player.active.base, self.events);
        }

        return [self, self.events.finish(self.turn++)];
    }

    cancel(idx: number, turn: number) {
        const player = this.players[idx];
        if (!player) {
            console.warn("attempt to choose for invalid player", idx);
            return;
        }

        if (turn !== this.turn) {
            console.warn("too late to cancel", idx);
            return;
        }

        player.choice = null;
    }

    choose(idx: number, choice: Choice) {
        if (this.victor) {
            console.warn("attempt to choose in finished battle", idx);
            return null;
        }

        const player = this.players[idx];
        // TODO: instead of logging, send warnings back to the client that issued the command
        if (!player) {
            console.warn("attempt to choose for invalid player", idx);
            return null;
        }

        if (choice.turn !== this.turn) {
            console.warn("cannot choose for turn ", choice.turn);
            return null;
        }

        if (choice.type === "move") {
            player.choice = {
                move: player.active.base.moves[choice.index],
                user: player.active,
                target: this.opponentOf(player).active,
            };
        } else if (choice.type === "switch") {
            throw new Error("TODO: switch moves");
        } else {
            throw new Error("invalid choice type");
        }

        if (!this.players.every(player => player.choice !== null)) {
            return null;
        }

        return this.runTurn();
    }

    private runTurn() {
        const choices = this.players
            .map(player => player.choice!)
            .sort((a, b) => {
                if (a.move.priority !== b.move.priority) {
                    return (b.move.priority ?? 0) - (a.move.priority ?? 0);
                }

                const aSpe = a.user.owner.active.getStat("spe", false);
                const bSpe = b.user.owner.active.getStat("spe", false);
                if (aSpe === bSpe) {
                    return randChance255(128) ? -1 : 1;
                }

                return bSpe - aSpe;
            });

        let skipEnd = false;
        for (const { move, user, target } of choices) {
            // https://bulbapedia.bulbagarden.net/wiki/Accuracy#Generation_I_and_II
            if (move.acc) {
                const chance =
                    Math.floor((move.acc / 100) * 255) *
                    user.getStat("acc", false) *
                    target.getStat("eva", false);
                if (!randChance255(chance)) {
                    this.events.push({
                        type: "failed",
                        src: user,
                        why: "miss",
                    });
                    continue;
                }
            }

            this.events.push({
                type: "move",
                src: user,
                move,
            });
            // A pokemon has died, skip all end of turn events
            if (move.execute(this, user, target)) {
                if (target.owner.team.every(poke => poke.hp <= 0) && !this.victor) {
                    this.victor = user.owner;
                }

                skipEnd = true;
                break;
            }
        }

        if (!skipEnd) {
            // TODO: end of turn events
        }

        for (const player of this.players) {
            player.choice = null;
        }

        if (this.victor) {
            this.events.push({
                type: "victory",
                player: this.victor,
            });
        }

        return this.events.finish(this.turn++);
    }

    private opponentOf(player: Player): Player {
        return this.players[0] === player ? this.players[1] : this.players[0];
    }
}

export type Stages = keyof ActivePokemon["stages"];

export class ActivePokemon {
    base: Pokemon;
    focus = false;
    readonly owner: Player;
    readonly types: Type[] = [];
    readonly stages = { atk: 0, def: 0, spc: 0, spe: 0, acc: 0, eva: 0 };

    constructor(base: Pokemon, owner: Player) {
        this.base = base;
        this.owner = owner;
    }

    switchTo(base: Pokemon, events: EventSystem) {
        events.push({
            type: "switch",
            src: this.base,
            target: base,
        });

        this.base = base;
        for (const k in this.stages) {
            // @ts-ignore
            this.stages[k] = 0;
        }
        this.focus = false;
        this.types.length = 0;
        this.types.push(...base.species.types);
    }

    getStat(stat: Stages, isCrit: boolean): number {
        // https://bulbapedia.bulbagarden.net/wiki/Stat_modifier#Stage_multipliers
        if (stat === "acc" || stat === "eva") {
            return stageMultipliers[this.stages[stat]];
        }

        // TODO: apply stages, par/brn, stat duplication bug
        return this.base.stats[stat];
    }
}
