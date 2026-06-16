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

export interface DaVinciTile {
  color: DaVinciColor;
  value: number; // -1 means hidden from this viewer
  revealed: boolean;
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
  phase: 'playing' | 'ended';
  stage: 'guessing' | 'deciding';
  players: DaVinciPlayerState[];
  currentPlayerIndex: number;
  deck: DaVinciTile[];
  deckCount: number;
  drawnTile: DaVinciTile | null;
  lastAction: DaVinciLastAction | null;
  winnerId: string | null;
  message: string;
}
