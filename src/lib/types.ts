export interface MediaEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: 20 | 22;
  content: string;
  tags: string[][];
  title?: string;
  media?: MediaItem[];
  duration?: number;
  published_at?: number;
}

export interface MediaItem {
  url: string;
  mimeType: string;
  dimensions?: string;
  blurhash?: string;
  alt?: string;
  x?: string;
  fallback?: string[];
  image?: string[];
  service?: string;
}

export interface ImetaData {
  url?: string;
  mimeType?: string;
  dimensions?: string;
  blurhash?: string;
  alt?: string;
  x?: string;
  fallback?: string[];
  image?: string[];
  service?: string;
}
