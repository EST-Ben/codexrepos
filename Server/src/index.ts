/**
 * Realm of Eternity - Game Server
 *
 * Main entry point for the multiplayer game server.
 * Handles WebSocket connections, game state, and player management.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { config } from './config.js';
import { PacketHandler } from './network/packet-handler.js';
import { PlayerManager } from './managers/player-manager.js';
import { ZoneManager } from './managers/zone-manager.js';
import { GameLoop } from './core/game-loop.js';

const httpServer = createServer();
const wss = new WebSocketServer({ server: httpServer });

// Initialize managers
const playerManager = new PlayerManager();
const zoneManager = new ZoneManager();
const packetHandler = new PacketHandler(playerManager, zoneManager);
const gameLoop = new GameLoop(playerManager, zoneManager);

wss.on('connection', (socket: WebSocket, request) => {
  console.log(`[Server] New connection from ${request.socket.remoteAddress}`);

  const playerId = playerManager.createPlayer(socket);

  socket.on('message', (data: Buffer) => {
    try {
      packetHandler.handle(playerId, data);
    } catch (error) {
      console.error(`[Server] Error handling packet:`, error);
    }
  });

  socket.on('close', () => {
    console.log(`[Server] Player ${playerId} disconnected`);
    playerManager.removePlayer(playerId);
  });

  socket.on('error', (error) => {
    console.error(`[Server] Socket error for player ${playerId}:`, error);
  });
});

// Start the game loop (20 ticks per second)
gameLoop.start(config.tickRate);

httpServer.listen(config.port, config.host, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║         REALM OF ETERNITY - GAME SERVER              ║
╠══════════════════════════════════════════════════════╣
║  Status:  ONLINE                                     ║
║  Host:    ${config.host.padEnd(20)}                  ║
║  Port:    ${String(config.port).padEnd(20)}          ║
║  Tick:    ${String(config.tickRate).padEnd(20)} Hz   ║
╚══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  gameLoop.stop();
  wss.close();
  httpServer.close();
  process.exit(0);
});
