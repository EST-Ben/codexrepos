/**
 * Player Manager
 *
 * Manages connected players, their state, and lifecycle.
 */

import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { Player, Character, Vector3 } from '../types/index.js';

export class PlayerManager {
  private players: Map<string, Player> = new Map();
  private socketToPlayer: Map<WebSocket, string> = new Map();

  createPlayer(socket: WebSocket): string {
    const playerId = uuidv4();

    const player: Player = {
      id: playerId,
      socket,
      zoneId: 1, // Starting zone
      lastUpdate: Date.now(),
    };

    this.players.set(playerId, player);
    this.socketToPlayer.set(socket, playerId);

    console.log(`[PlayerManager] Created player ${playerId}`);
    return playerId;
  }

  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      this.socketToPlayer.delete(player.socket);
      this.players.delete(playerId);
      console.log(`[PlayerManager] Removed player ${playerId}`);
    }
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  getPlayerBySocket(socket: WebSocket): Player | undefined {
    const playerId = this.socketToPlayer.get(socket);
    return playerId ? this.players.get(playerId) : undefined;
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  getPlayersInZone(zoneId: number): Player[] {
    return this.getAllPlayers().filter((p) => p.zoneId === zoneId);
  }

  setCharacter(playerId: string, character: Character): void {
    const player = this.players.get(playerId);
    if (player) {
      player.character = character;
      player.characterId = character.id;
      console.log(
        `[PlayerManager] Player ${playerId} loaded character ${character.name}`
      );
    }
  }

  updatePosition(playerId: string, position: Vector3, rotation: number): void {
    const player = this.players.get(playerId);
    if (player?.character) {
      player.character.position = position;
      player.character.rotation = rotation;
      player.lastUpdate = Date.now();
    }
  }

  changeZone(playerId: string, newZoneId: number): void {
    const player = this.players.get(playerId);
    if (player) {
      const oldZoneId = player.zoneId;
      player.zoneId = newZoneId;
      console.log(
        `[PlayerManager] Player ${playerId} moved from zone ${oldZoneId} to ${newZoneId}`
      );
    }
  }

  update(deltaTime: number): void {
    const now = Date.now();
    const timeout = 30000; // 30 second timeout

    for (const [playerId, player] of this.players) {
      // Check for inactive players
      if (now - player.lastUpdate > timeout) {
        console.log(`[PlayerManager] Player ${playerId} timed out`);
        player.socket.close();
        this.removePlayer(playerId);
      }
    }
  }

  get playerCount(): number {
    return this.players.size;
  }

  broadcast(zoneId: number, data: Buffer, excludePlayerId?: string): void {
    const zonePlayers = this.getPlayersInZone(zoneId);

    for (const player of zonePlayers) {
      if (player.id === excludePlayerId) continue;
      if (player.socket.readyState === WebSocket.OPEN) {
        player.socket.send(data);
      }
    }
  }
}
