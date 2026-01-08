# Realm of Eternity

An open-world MMORPG built with Unreal Engine 5, featuring classless progression, a player-driven economy, and the freedom to pursue any path in a vast fantasy world.

## Vision

A living, breathing world where players can:
- **Gather & Craft** - Deep resource gathering and crafting systems
- **Explore** - Vast open world with diverse biomes and secrets
- **Quest** - Rich storylines and dynamic world events
- **Trade** - Player-driven economy
- **Build** - Player housing and guild territories
- **Fight** - PvE dungeons, world bosses, and optional PvP zones

## Project Structure

```
/
├── Game/                 # Unreal Engine 5 Project
├── Server/               # Multiplayer game server
│   └── src/              # Server source code
├── Docs/                 # Game design documents
├── Data/                 # Game data configuration
│   ├── Items/            # Item definitions
│   ├── Skills/           # Skill trees and progression
│   ├── Npcs/             # NPC definitions
│   ├── Quests/           # Quest definitions
│   └── World/            # World/zone configurations
└── Tools/                # Build and development tools
```

## Technology Stack

- **Game Engine**: Unreal Engine 5.4+
- **Game Server**: C++ / Node.js dedicated server
- **Database**: PostgreSQL for persistent data
- **Networking**: Custom UDP protocol + WebSocket fallback

## Getting Started

### Prerequisites
- Unreal Engine 5.4 or later
- Visual Studio 2022 (Windows) or Xcode (Mac)
- Node.js 20+ (for server development)
- PostgreSQL 15+

### Setup

1. Clone this repository
2. Open `Game/RealmOfEternity.uproject` in Unreal Engine
3. Set up the server (see `Server/README.md`)
4. Configure your database connection

## Development Status

🚧 **Pre-Alpha** - Foundation and core systems in development

## License

Proprietary - All rights reserved
