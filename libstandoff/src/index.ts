import { type Turn } from "./battle";
import { type PlayerId } from "./events";
import { Lobby } from "./lobby";
import { DamagingMove } from "./move";
import { Pokemon, type Status } from "./pokemon";
import { mewtwo } from "./species";
import { randRangeInclusive } from "./utils";

type ClientPokemon = {
    dexId: number;
    name: string;
    hp: number;
    status: Status | null;
};

class LogClient {
    players: { [key: PlayerId]: { active: ClientPokemon | null; name: string } } = {};
    me: PlayerId;

    constructor(me: PlayerId) {
        this.me = me;
    }

    logEvents({ turn, events }: Turn) {
        if (turn) {
            console.log(`\nTurn ${turn}:`);
        }

        for (const event of events) {
            switch (event.type) {
                case "init":
                    this.players[event.opponent.id] = {
                        active: null,
                        name: event.opponent.name,
                    };
                    break;
                case "switch":
                    {
                        const player = this.players[event.src];
                        if (player.active !== null) {
                            console.log(`${player.name} withdrew ${player.active.name}!`);
                        }
                        player.active = { ...event };
                        console.log(
                            `${player.name} sent in ${event.name}! (${event.hp}/${event.maxHp})`
                        );
                    }
                    break;
                case "damage":
                    {
                        const src = this.players[event.src].active!;
                        const target = this.players[event.target].active!;

                        console.log(
                            `${src.name} dealt ${event.hpBefore - event.hpAfter}${
                                event.target === this.me ? " damage" : "%"
                            } to ${target.name} (${event.hpAfter} remaining)`
                        );
                        if (event.isCrit) {
                            console.log(` - A critical hit!`);
                        }
                        if (event.eff !== 1) {
                            console.log(
                                ` - It was ${
                                    event.eff > 1 ? "supereffective!" : "not very effective..."
                                }`
                            );
                        }
                    }
                    break;
                case "failed":
                    {
                        const src = this.players[event.src].active!;
                        switch (event.why) {
                            case "immune":
                                console.log(`It doesn't affect ${src.name}...`);
                                break;
                            case "miss":
                                console.log(`${src.name} missed!`);
                                break;
                        }
                    }
                    break;
                case "move":
                    {
                        const src = this.players[event.src].active!;
                        console.log(`${src.name} used ${event.move.name}!`);
                    }
                    break;
                case "victory":
                    console.log(`${this.players[event.id].name} wins!`);
                    break;
                default:
                    throw new Error(`unhandled event: ${JSON.stringify(event)}`);
            }
        }
    }
}

const earthquake = new DamagingMove("Earthquake", 10, "ground", 100, 100);
const quickAttack = new DamagingMove("Quick Attack", 40, "normal", 40, 100, +1);

const pokemon1 = new Pokemon(mewtwo, { spe: 15 }, {}, 100, [earthquake, quickAttack], "Mewtwo 1");
const pokemon2 = new Pokemon(mewtwo, {}, {}, 100, [earthquake, quickAttack], "Mewtwo 2");

const lobby = new Lobby();

const player1 = lobby.join("Player 1", [pokemon1]);
const player2 = lobby.join("Player 2", [pokemon2]);

const client = new LogClient(player1);

lobby.on("turn", (id, turn, events) => {
    if (id === client.me) {
        client.logEvents({ turn, events: JSON.parse(events) });
    }
});

lobby.on("endTurn", (id, turn, validMoves) => {
    if (!lobby.isPlaying()) {
        return;
    }

    const { canSwitch: _, moves } = JSON.parse(validMoves);
    lobby.chooseFor(id, {
        type: "move",
        index: randRangeInclusive(0, moves.length - 1),
        turn: turn + 1,
    });
});

lobby.startBattle();
