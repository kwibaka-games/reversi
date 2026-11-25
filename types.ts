export type ReversiColor = 'black' | 'white';
export type ReversiCell = ReversiColor | null;

export interface ReversiPlayerView {
  userId: string;
  name: string;
  seat: number;
  color: ReversiColor;
  count: number;
}

export interface ReversiResult {
  winners: string[];
  reason: 'resign' | 'board_full' | 'one_color_eliminated' | 'no_moves';
  counts: { black: number; white: number };
  colors: { black: string; white: string };
  board: ReversiCell[];
}

export interface ReversiView {
  schema: 'reversi-v1';
  status: 'waiting' | 'playing' | 'finished';
  board: ReversiCell[];
  players: ReversiPlayerView[];
  you: { userId: string; color: ReversiColor } | null;
  turn: ReversiColor | null;
  counts: { black: number; white: number };
  result?: ReversiResult;
}

export type ReversiAction =
  | { type: 'place'; index: number; label?: string }
  | { type: 'resign'; label?: string };
