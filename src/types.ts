/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum Color {
  WHITE = 'White',
  BLACK = 'Black',
  BYE = 'Bye'
}

export interface Player {
  id: string;
  name: string;
  score: number;
  history: string[]; // List of opponent IDs
  colorHistory: Color[];
  receivedBye: boolean;
  buchholz?: number;
}

export interface Match {
  id: string;
  white: string; // Player ID
  black: string; // Player ID
  result: '1-0' | '0-1' | '0.5-0.5' | null;
}

export interface Round {
  roundNumber: number;
  matches: Match[];
  byePlayerId: string | null;
}

export interface Tournament {
  players: Player[];
  rounds: Round[];
  currentRound: number;
  totalRounds: number;
}
