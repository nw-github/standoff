import { Battle, Player } from "./battle";
import { type Turn } from "./event";
import { DamagingMove } from "./move";
import { Pokemon } from "./pokemon";
import { mewtwo } from "./species";
import { randRangeInclusive } from "./utils";

const logEvents = ({ turn, events }: Turn) => {
    if (turn) {
        console.log(`Turn ${turn}:`);
    }

    for (const event of events) {
        switch (event.type) {
            case "switch":
                if (event.src === event.target) {
                    console.log(`Sent in ${event.target.name}`);
                } else {
                    console.log(`${event.src.name} switched to ${event.target.name}`);
                }
                break;
            case "damage":
                console.log(
                    `${event.src.base.name} dealt ${event.hpBefore - event.hpAfter} damage to ${
                        event.target.base.name
                    } (${event.hpAfter} remaining)`,
                );
                if (event.isCrit) {
                    console.log(` - A critical hit!`);
                }
                if (event.eff !== 1) {
                    console.log(
                        ` - It was ${event.eff > 1 ? "supereffective!" : "not very effective..."}`,
                    );
                }
                break;
            case "failed":
                switch (event.why) {
                    case "immune":
                        console.log(`It doesn't affect ${event.src.base.name}...`);
                        break;
                    case "miss":
                        console.log(`${event.src.base.name} missed!`);
                        break;
                }
                break;
            case "move":
                console.log(`${event.src.base.name} used ${event.move.name}!`);
                break;
            case "victory":
                console.log(`${event.player.name} wins!`);
                break;
            default:
                throw new Error(`unhandled event: ${event}`);
        }
    }
};

const earthquake = new DamagingMove("Earthquake", 10, "ground", 100, 100);
const quickAttack = new DamagingMove("Quick Attack", 40, "normal", 40, 100, +1);

const pokemon1 = new Pokemon(mewtwo, { spe: 15 }, {}, 100, [earthquake, quickAttack], "Mewtwo 1");
const pokemon2 = new Pokemon(mewtwo, {}, {}, 100, [earthquake, quickAttack], "Mewtwo 2");

const [battle, events] = Battle.start(
    new Player("Player 1", [pokemon1]),
    new Player("Player 2", [pokemon2]),
);
console.log("battle start: ");
logEvents(events);

let turn = 1;
while (!battle.victor) {
    battle.choose(0, {
        type: "move",
        index: randRangeInclusive(0, pokemon1.moves.length - 1),
        turn,
    });

    logEvents(
        battle.choose(1, {
            type: "move",
            index: randRangeInclusive(0, pokemon1.moves.length - 1),
            turn,
        })!,
    );

    turn++;
}
