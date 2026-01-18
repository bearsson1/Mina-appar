
export interface Question {
  id: number;
  text: string;
  options: {
    '1': string;
    'X': string;
    '2': string;
  };
  correct: '1' | 'X' | '2';
}

export interface QuizPoint {
  id: number;
  lat: number;
  lng: number;
  unlocked: boolean;
  answered: boolean;
  isCorrect?: boolean;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  avatar: string;
  isMe?: boolean;
}

export enum AppTab {
  MAP = 'MAP',
  LEADERBOARD = 'LEADERBOARD',
  FRIENDS = 'FRIENDS',
  PROFILE = 'PROFILE'
}
