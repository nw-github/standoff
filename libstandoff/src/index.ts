import { Battle, Player, type Turn } from "./battle";
import { PlayerId } from "./events";
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
    turn = 0;
    players: { [key: PlayerId]: { active: ClientPokemon | null; name: string } } = {};

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
                            `${src.name} dealt ${event.hpBefore - event.hpAfter} damage to ${
                                target.name
                            } (${event.hpAfter} remaining)`
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
                    throw new Error(`unhandled event: ${event}`);
            }
        }

        this.turn++;
    }
}

const earthquake = new DamagingMove("Earthquake", 10, "ground", 100, 100);
const quickAttack = new DamagingMove("Quick Attack", 40, "normal", 40, 100, +1);

const pokemon1 = new Pokemon(mewtwo, { spe: 15 }, {}, 100, [earthquake, quickAttack], "Mewtwo 1");
const pokemon2 = new Pokemon(mewtwo, {}, {}, 100, [earthquake, quickAttack], "Mewtwo 2");

const [battle, events] = Battle.start(
    new Player("Player 1", 0, [pokemon1]),
    new Player("Player 2", 1, [pokemon2])
);

let client = new LogClient();
client.logEvents(events);

while (!battle.victor) {
    battle.choose(0, {
        type: "move",
        index: randRangeInclusive(0, pokemon1.moves.length - 1),
        turn: client.turn,
    });

    client.logEvents(
        battle.choose(1, {
            type: "move",
            index: randRangeInclusive(0, pokemon1.moves.length - 1),
            turn: client.turn,
        })!
    );
}
