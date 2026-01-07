/**
 * Packet Handler
 *
 * Processes incoming network packets and routes to appropriate handlers.
 */

import { PacketType, Packet, Vector3 } from '../types/index.js';
import { PlayerManager } from '../managers/player-manager.js';
import { ZoneManager } from '../managers/zone-manager.js';

export class PacketHandler {
  constructor(
    private playerManager: PlayerManager,
    private zoneManager: ZoneManager
  ) {}

  handle(playerId: string, data: Buffer): void {
    if (data.length < 8) {
      console.warn(`[PacketHandler] Received invalid packet (too short)`);
      return;
    }

    const packet = this.parsePacket(data);
    if (!packet) return;

    switch (packet.type) {
      case PacketType.PING:
        this.handlePing(playerId);
        break;

      case PacketType.AUTH:
        this.handleAuth(playerId, packet.payload);
        break;

      case PacketType.MOVE:
        this.handleMove(playerId, packet.payload);
        break;

      case PacketType.ATTACK:
        this.handleAttack(playerId, packet.payload);
        break;

      case PacketType.CHAT_MESSAGE:
        this.handleChat(playerId, packet.payload);
        break;

      case PacketType.NPC_INTERACT:
        this.handleNPCInteract(playerId, packet.payload);
        break;

      case PacketType.SKILL_ACTION:
        this.handleSkillAction(playerId, packet.payload);
        break;

      case PacketType.ITEM_USE:
        this.handleItemUse(playerId, packet.payload);
        break;

      default:
        console.warn(
          `[PacketHandler] Unknown packet type: 0x${packet.type.toString(16)}`
        );
    }
  }

  private parsePacket(data: Buffer): Packet | null {
    try {
      const length = data.readUInt16BE(0);
      const type = data.readUInt16BE(2) as PacketType;
      const sequence = data.readUInt32BE(4);
      const payload = data.subarray(8);

      return { type, sequence, payload };
    } catch (error) {
      console.error(`[PacketHandler] Failed to parse packet:`, error);
      return null;
    }
  }

  private handlePing(playerId: string): void {
    const player = this.playerManager.getPlayer(playerId);
    if (!player) return;

    // Send PONG response
    const pong = Buffer.alloc(8);
    pong.writeUInt16BE(8, 0); // length
    pong.writeUInt16BE(PacketType.PONG, 2); // type
    pong.writeUInt32BE(0, 4); // sequence

    player.socket.send(pong);
  }

  private handleAuth(playerId: string, payload: Buffer): void {
    // TODO: Implement authentication
    // 1. Parse token from payload
    // 2. Verify JWT
    // 3. Load account and character data
    // 4. Send AUTH_RESPONSE with success/failure
    console.log(`[PacketHandler] Auth request from player ${playerId}`);
  }

  private handleMove(playerId: string, payload: Buffer): void {
    if (payload.length < 16) return;

    const x = payload.readFloatBE(0);
    const y = payload.readFloatBE(4);
    const z = payload.readFloatBE(8);
    const rotation = payload.readFloatBE(12);

    const position: Vector3 = { x, y, z };

    // Update player position
    this.playerManager.updatePosition(playerId, position, rotation);

    // Check if player entered a new zone
    const player = this.playerManager.getPlayer(playerId);
    if (player) {
      const newZone = this.zoneManager.getZoneForPosition(position);
      if (newZone && newZone.id !== player.zoneId) {
        this.zoneManager.removePlayerFromZone(playerId, player.zoneId);
        this.zoneManager.addPlayerToZone(playerId, newZone.id);
        this.playerManager.changeZone(playerId, newZone.id);
      }
    }
  }

  private handleAttack(playerId: string, payload: Buffer): void {
    // TODO: Implement combat
    // 1. Parse target ID and attack type
    // 2. Validate attack (range, cooldowns, resources)
    // 3. Calculate damage
    // 4. Apply damage to target
    // 5. Broadcast damage events
    console.log(`[PacketHandler] Attack from player ${playerId}`);
  }

  private handleChat(playerId: string, payload: Buffer): void {
    const player = this.playerManager.getPlayer(playerId);
    if (!player) return;

    // Parse chat message
    const channelId = payload.readUInt8(0);
    const messageLength = payload.readUInt16BE(1);
    const message = payload.subarray(3, 3 + messageLength).toString('utf8');

    console.log(`[Chat] Player ${playerId}: ${message}`);

    // Broadcast to zone
    // TODO: Build and send CHAT_BROADCAST packet
  }

  private handleNPCInteract(playerId: string, payload: Buffer): void {
    // TODO: Implement NPC interaction
    // 1. Parse NPC ID
    // 2. Check distance to NPC
    // 3. Open appropriate dialog or shop
    console.log(`[PacketHandler] NPC interact from player ${playerId}`);
  }

  private handleSkillAction(playerId: string, payload: Buffer): void {
    // TODO: Implement skill actions
    // 1. Parse skill type and action
    // 2. Validate requirements (level, tools, resources)
    // 3. Start action timer
    // 4. On completion, grant XP and resources
    console.log(`[PacketHandler] Skill action from player ${playerId}`);
  }

  private handleItemUse(playerId: string, payload: Buffer): void {
    // TODO: Implement item usage
    // 1. Parse item slot and target
    // 2. Validate item exists in inventory
    // 3. Apply item effect
    // 4. Consume if consumable
    console.log(`[PacketHandler] Item use from player ${playerId}`);
  }
}
