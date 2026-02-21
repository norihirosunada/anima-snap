export interface ObjectPersonality {
  traits: string[];
  speechStyle: string;
  backstory: string;
  nickname: string;
  tone: string;
}

export interface AlbumPhoto {
  id: string;
  url: string;
  timestamp: number;
  source: 'initial' | 're-encounter' | 'manual';
}

export interface AnimismObject {
  id: string;
  name: string;
  type: string;
  personality: ObjectPersonality;
  affinity: number; // 0-100
  capturedAt: number;
  snapshotUrl: string; // base64 data URL
  albumPhotos: AlbumPhoto[];
  awakeningVideoUrl?: string; // Veo generated video URL
  questionnaire?: QuestionnaireAnswer[];
  stats: {
    totalEncounters: number;
    lastSeenAt: number;
  };
}

export interface QuestionnaireAnswer {
  question: string;
  answer: string;
}

export interface Memory {
  id: string;
  objectId: string;
  timestamp: number;
  type: 'awakening' | 're-encounter' | 'chat';
  content: string;
  snapshotUrl?: string;
}

export type AppScreen = 'capture' | 'collection' | 'chat' | 'detail' | 'admin';

export type CaptureState =
  | 'idle'
  | 'scanning'
  | 'analyzing'
  | 'questionnaire'
  | 'awakening'
  | 'registered'
  | 're-encounter';

export interface AnalyzeResult {
  isNew: boolean;
  matchedId?: string;
  objectName: string;
  objectType: string;
  description: string;
}

export interface QuestionItem {
  id: string;
  question: string;
  options: string[];
}
