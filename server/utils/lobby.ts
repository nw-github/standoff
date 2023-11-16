// import { Battle, type Choice, Player, SelectionError, type Turn } from "../../game/battle";
// import { type PlayerId, type BattleEvent } from "../../game/events";
// import { EventEmitter } from "events";
// import { hpPercent } from "../../game/utils";
// 
// export class Lobby extends EventEmitter {
//     leave(id: PlayerId) {
//         const playerIdx = this.players.findIndex(player => player.id === id);
//         if (playerIdx !== -1) {
//             const [player] = this.players.splice(playerIdx, 1);
//             this.emit("leave", player.id);
//             // TODO: end the game
// 
//             this.battle = null;
//             return;
//         }
// 
//         const specIdx = this.spectators.findIndex(player => player.id === id);
//         if (specIdx !== -1) {
//             const [player] = this.spectators.splice(specIdx, 1);
//             this.emit("leave", player.id);
//             return;
//         }
// 
//         console.warn(`Unknown player with ID ${id} requested to leave.`);
//     }
// 
//     chooseFor(id: PlayerId, choice: Choice): SelectionError["type"] | undefined {
//         if (!this.battle) {
//             return "battle_not_started";
//         }
// 
//         try {
//             const turn = this.battle.choose(id, choice);
//             if (turn) {
//                 this.broadcastTurn(turn);
//             }
//         } catch (err) {
//             if (err instanceof SelectionError) {
//                 return err.type;
//             }
//         }
//     }
// 
//     cancelFor(id: PlayerId, turn: number) {
//         if (!this.battle) {
//             return "battle_not_started";
//         }
// 
//         try {
//             this.battle.cancel(id, turn);
//         } catch (err) {
//             if (err instanceof SelectionError) {
//                 return err.type;
//             }
//         }
//     }
// }
