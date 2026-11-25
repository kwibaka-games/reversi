import type { GameMetadata } from '../../protocol/protocol.js';

export const REVERSI_GAME: GameMetadata = {
  id: 'reversi',
  name: '黑白棋',
  version: '0.1.0',
  protocol: 1,
  minPlayers: 2,
  maxPlayers: 2,
  description: '经典 8×8 黑白棋（完全信息，观战者可发言）',
  author: 'kwibaka',
  spectatorChat: true,
};
