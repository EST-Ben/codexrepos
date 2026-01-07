/**
 * Game Loop
 *
 * Main simulation loop running at fixed tick rate.
 * Processes game state updates and broadcasts to clients.
 */

import { PlayerManager } from '../managers/player-manager.js';
import { ZoneManager } from '../managers/zone-manager.js';

export class GameLoop {
  private running = false;
  private tickInterval: NodeJS.Timeout | null = null;
  private tickCount = 0;
  private lastTickTime = 0;

  constructor(
    private playerManager: PlayerManager,
    private zoneManager: ZoneManager
  ) {}

  start(tickRate: number): void {
    if (this.running) return;

    this.running = true;
    const tickMs = 1000 / tickRate;
    this.lastTickTime = Date.now();

    this.tickInterval = setInterval(() => {
      this.tick();
    }, tickMs);

    console.log(`[GameLoop] Started at ${tickRate} Hz (${tickMs}ms per tick)`);
  }

  stop(): void {
    if (!this.running) return;

    this.running = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    console.log(`[GameLoop] Stopped after ${this.tickCount} ticks`);
  }

  private tick(): void {
    const now = Date.now();
    const deltaTime = now - this.lastTickTime;
    this.lastTickTime = now;
    this.tickCount++;

    try {
      // Update all zones
      this.zoneManager.update(deltaTime);

      // Process player states
      this.playerManager.update(deltaTime);

      // Broadcast state updates to nearby players
      this.broadcastUpdates();
    } catch (error) {
      console.error(`[GameLoop] Error in tick ${this.tickCount}:`, error);
    }
  }

  private broadcastUpdates(): void {
    // Get all players and broadcast their positions to nearby players
    const players = this.playerManager.getAllPlayers();

    for (const player of players) {
      if (!player.character) continue;

      const nearbyPlayers = this.playerManager.getPlayersInZone(player.zoneId);

      for (const nearby of nearbyPlayers) {
        if (nearby.id === player.id) continue;
        // TODO: Send position update packet to nearby player
      }
    }
  }

  get isRunning(): boolean {
    return this.running;
  }

  get currentTick(): number {
    return this.tickCount;
  }
}
