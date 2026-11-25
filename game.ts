import type { GameToPlatform, PlatformToGame, Seat } from '../../protocol/protocol.js';
import { REVERSI_GAME } from './metadata.js';
import type {
  ReversiAction,
  ReversiCell,
  ReversiColor,
  ReversiResult,
  ReversiView,
} from './types.js';

const DIRECTIONS: readonly [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

export function opposite(color: ReversiColor): ReversiColor {
  return color === 'black' ? 'white' : 'black';
}

export function initialBoard(): ReversiCell[] {
  const board: ReversiCell[] = Array<ReversiCell>(64).fill(null);
  board[27] = 'white';
  board[28] = 'black';
  board[35] = 'black';
  board[36] = 'white';
  return board;
}

function inside(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

/** Return all discs flipped by placing `color` at index, without mutating. */
export function flipsFor(board: ReversiCell[], index: number, color: ReversiColor): number[] {
  if (!Number.isInteger(index) || index < 0 || index >= 64 || board[index]) return [];
  const row = Math.floor(index / 8);
  const col = index % 8;
  const opponent = opposite(color);
  const flipped: number[] = [];
  for (const [dr, dc] of DIRECTIONS) {
    const line: number[] = [];
    let r = row + dr;
    let c = col + dc;
    while (inside(r, c) && board[r * 8 + c] === opponent) {
      line.push(r * 8 + c);
      r += dr;
      c += dc;
    }
    if (line.length > 0 && inside(r, c) && board[r * 8 + c] === color) {
      flipped.push(...line);
    }
  }
  return flipped;
}

export function legalMoves(board: ReversiCell[], color: ReversiColor): number[] {
  const result: number[] = [];
  for (let index = 0; index < 64; index += 1) {
    if (flipsFor(board, index, color).length > 0) result.push(index);
  }
  return result;
}

export function countDiscs(board: ReversiCell[]): { black: number; white: number } {
  let black = 0;
  let white = 0;
  for (const cell of board) {
    if (cell === 'black') black += 1;
    else if (cell === 'white') white += 1;
  }
  return { black, white };
}

function cellName(index: number): string {
  return `${String.fromCharCode(65 + (index % 8))}${Math.floor(index / 8) + 1}`;
}

interface Match {
  id: string;
  seats: Seat[];
  board: ReversiCell[];
  colors: Record<ReversiColor, string>;
  turn: ReversiColor;
  status: 'waiting' | 'playing' | 'finished';
  seq: number;
  ready: Set<string>;
  result: ReversiResult | null;
  started: boolean;
}

export class ReversiMatch {
  private readonly matches = new Map<string, Match>();

  constructor(private readonly send: (message: GameToPlatform) => void) {}

  handle(message: PlatformToGame): void {
    switch (message.t) {
      case 'match.create':
        this.create(message.matchId, message.seats, message.settings);
        return;
      case 'player.ready':
        this.ready(message.matchId, message.playerId);
        return;
      case 'action':
        this.action(message.matchId, message.playerId, message.action);
        return;
      case 'player.connection':
        if (message.connected) this.sendViewToPlayer(message.matchId, message.playerId);
        return;
      case 'match.abort':
        this.matches.delete(message.matchId);
        return;
      default:
        return;
    }
  }

  getMetadata(): typeof REVERSI_GAME {
    return REVERSI_GAME;
  }

  private create(matchId: string, seats: Seat[], settings: Record<string, unknown>): void {
    if (seats.length !== 2) {
      this.send({
        v: 1,
        t: 'error',
        matchId,
        code: 'E_PLAYERS',
        message: '黑白棋需要正好 2 名玩家',
      });
      return;
    }
    const hostUserId = typeof settings.hostUserId === 'string' ? settings.hostUserId : seats[0]!.userId;
    const hostColor: ReversiColor = settings.hostColor === 'white' ? 'white' : 'black';
    const host = seats.find((seat) => seat.userId === hostUserId) ?? seats[0]!;
    const other = seats.find((seat) => seat.userId !== host.userId)!;
    const colors: Record<ReversiColor, string> = {
      [hostColor]: host.userId,
      [opposite(hostColor)]: other.userId,
    };
    const match: Match = {
      id: matchId,
      seats,
      board: initialBoard(),
      colors,
      turn: 'black',
      status: 'waiting',
      seq: 1,
      ready: new Set(),
      result: null,
      started: false,
    };
    this.matches.set(matchId, match);
    this.sendViews(match);
  }

  private ready(matchId: string, playerId: string): void {
    const match = this.matches.get(matchId);
    if (!match || match.started) return;
    if (!match.seats.some((seat) => seat.userId === playerId)) return;
    match.ready.add(playerId);
    if (match.seats.every((seat) => match.ready.has(seat.userId))) {
      match.started = true;
      match.status = 'playing';
      this.send({ v: 1, t: 'match.started', matchId });
      this.sendViews(match);
    }
  }

  private action(matchId: string, playerId: string, action: unknown): void {
    const match = this.matches.get(matchId);
    if (!match || match.status !== 'playing' || !match.started) return;
    const player = match.seats.find((seat) => seat.userId === playerId);
    if (!player) return;
    const color = this.colorOf(match, playerId);
    if (!color) return;

    if (!action || typeof action !== 'object') {
      this.error(matchId, playerId, 'E_ILLEGAL', '动作格式错误');
      return;
    }
    const type = (action as { type?: unknown }).type;

    if (type === 'resign') {
      match.seq += 1;
      this.finish(match, 'resign', opposite(color));
      return;
    }

    if (type !== 'place') {
      this.error(matchId, playerId, 'E_ILLEGAL', '只支持 place 或 resign');
      return;
    }
    if (match.turn !== color) {
      this.error(matchId, playerId, 'E_TURN', '还没轮到你');
      return;
    }
    const index = Number((action as { index?: unknown }).index);
    if (!Number.isInteger(index) || index < 0 || index >= 64) {
      this.error(matchId, playerId, 'E_ILLEGAL', '落子位置不合法');
      return;
    }
    const flipped = flipsFor(match.board, index, color);
    if (flipped.length === 0) {
      this.error(matchId, playerId, 'E_ILLEGAL', '这一步不能夹住对方棋子');
      return;
    }

    match.board[index] = color;
    for (const flippedIndex of flipped) match.board[flippedIndex] = color;
    match.seq += 1;
    const counts = countDiscs(match.board);

    if (counts[opposite(color)] === 0) {
      this.finish(match, 'one_color_eliminated', color);
      return;
    }
    if (match.board.every((cell) => cell !== null)) {
      this.finish(match, 'board_full');
      return;
    }

    const opponent = opposite(color);
    if (legalMoves(match.board, opponent).length > 0) {
      match.turn = opponent;
    } else if (legalMoves(match.board, color).length > 0) {
      // Opponent has no legal move: pass back to the same player.
      match.turn = color;
    } else {
      this.finish(match, 'no_moves');
      return;
    }
    this.sendViews(match);
  }

  private finish(
    match: Match,
    reason: ReversiResult['reason'],
    forcedWinner?: ReversiColor,
  ): void {
    const counts = countDiscs(match.board);
    let winners: string[] = [];
    if (forcedWinner) {
      winners = [match.colors[forcedWinner]];
    } else if (counts.black > counts.white) {
      winners = [match.colors.black];
    } else if (counts.white > counts.black) {
      winners = [match.colors.white];
    }
    const result: ReversiResult = {
      winners,
      reason,
      counts,
      colors: { ...match.colors },
      board: [...match.board],
    };
    match.status = 'finished';
    match.result = result;
    this.sendViews(match);
    this.send({ v: 1, t: 'result', matchId: match.id, result });
  }

  private colorOf(match: Match, userId: string): ReversiColor | null {
    if (match.colors.black === userId) return 'black';
    if (match.colors.white === userId) return 'white';
    return null;
  }

  private error(matchId: string, playerId: string, code: string, message: string): void {
    this.send({ v: 1, t: 'error', matchId, playerId, code, message });
  }

  private viewFor(match: Match, userId: string | null): ReversiView {
    const counts = countDiscs(match.board);
    return {
      schema: 'reversi-v1',
      status: match.status,
      board: [...match.board],
      players: match.seats.map((seat) => {
        const color = this.colorOf(match, seat.userId)!;
        return {
          userId: seat.userId,
          name: seat.name,
          seat: seat.seat,
          color,
          count: counts[color],
        };
      }),
      you: userId ? { userId, color: this.colorOf(match, userId)! } : null,
      turn: match.status === 'playing' ? match.turn : null,
      counts,
      ...(match.result ? { result: match.result } : {}),
    };
  }

  private actionsFor(match: Match, userId: string): ReversiAction[] {
    if (match.status !== 'playing') return [];
    const color = this.colorOf(match, userId);
    if (!color) return [];
    const actions: ReversiAction[] = [];
    if (match.turn === color) {
      for (const index of legalMoves(match.board, color)) {
        actions.push({ type: 'place', index, label: `落子 ${cellName(index)}` });
      }
    }
    actions.push({ type: 'resign', label: '认输' });
    return actions;
  }

  private sendViews(match: Match): void {
    for (const seat of match.seats) {
      this.send({
        v: 1,
        t: 'view',
        matchId: match.id,
        to: `player:${seat.userId}`,
        seq: match.seq,
        view: this.viewFor(match, seat.userId),
        actions: this.actionsFor(match, seat.userId),
      });
    }
    this.send({
      v: 1,
      t: 'view',
      matchId: match.id,
      to: 'spectator',
      seq: match.seq,
      view: this.viewFor(match, null),
      actions: [],
    });
  }

  private sendViewToPlayer(matchId: string, playerId: string): void {
    const match = this.matches.get(matchId);
    if (!match) return;
    const color = this.colorOf(match, playerId);
    if (!color) return;
    this.send({
      v: 1,
      t: 'view',
      matchId,
      to: `player:${playerId}`,
      seq: match.seq,
      view: this.viewFor(match, playerId),
      actions: this.actionsFor(match, playerId),
    });
  }
}
