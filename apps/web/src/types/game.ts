export interface UndercoverPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  isAlive: boolean;
  word: string | null;
  isUndercover: boolean;
  isWhiteBoard: boolean;
  description: string | null;
  votedFor: string | null;
}

export interface UndercoverGameState {
  phase: 'describe' | 'vote' | 'reveal' | 'ended';
  round: number;
  civilianWord: string;
  undercoverWord: string;
  players: UndercoverPlayerState[];
  currentSpeakerIndex: number;
  votes: Record<string, string>;
  winner: 'civilian' | 'undercover' | 'whiteboard' | null;
  message: string;
}

export type DaVinciColor = 'black' | 'white';

// Mirror of the engine sentinel: a Joker tile and a "guess Joker" both use 12.
export const JOKER_VALUE = 12;

export interface DaVinciTile {
  color: DaVinciColor;
  value: number; // -1 means hidden from this viewer; 12 (JOKER_VALUE) on a Joker
  revealed: boolean;
  isJoker: boolean;
}

export interface DaVinciPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  rack: DaVinciTile[];
  eliminated: boolean;
}

export interface DaVinciLastAction {
  guesserId: string;
  guesserName: string;
  targetId: string;
  targetName: string;
  position: number;
  color: DaVinciColor;
  guessedValue: number;
  correct: boolean;
}

export interface DaVinciGameState {
  phase: 'setup' | 'playing' | 'ended';
  stage: 'guessing' | 'deciding' | 'placing';
  players: DaVinciPlayerState[];
  currentPlayerIndex: number;
  deck: DaVinciTile[];
  deckCount: number;
  drawnTile: DaVinciTile | null;
  lastAction: DaVinciLastAction | null;
  winnerId: string | null;
  message: string;
  useJoker: boolean;
  assistMode: boolean;
  placement: { faceUp: boolean } | null;
  setupReady: string[];
}
