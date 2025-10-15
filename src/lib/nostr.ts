import { SimplePool, type Event } from 'nostr-tools';
import { getConfig } from './config';
import type { MediaEvent, MediaItem } from './types';

export interface ProfileMetadata {
  name?: string;
  display_name?: string;
  picture?: string;
  about?: string;
  nip05?: string;
}

export class NostrService {
  private pool: SimplePool;
  private relays: string[];
  private profileCache: Map<string, ProfileMetadata> = new Map();

  constructor() {
    this.pool = new SimplePool();
    const config = getConfig();
    this.relays = config.relays;
  }

  async connect(): Promise<void> {
    const results = await Promise.allSettled(
      this.relays.map((relay) => this.pool.ensureRelay(relay))
    );

    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === this.relays.length) {
      throw new Error('Failed to connect to any relay');
    }

    if (failed > 0) {
      console.warn(`Failed to connect to ${failed} relays`);
    }
  }

  parseImetaTag(imetaTag: string[]): MediaItem | null {
    const data: Partial<MediaItem> = {};
    const parsers = {
      'url ': (v: string) => (data.url = v),
      'm ': (v: string) => (data.mimeType = v),
      'dim ': (v: string) => (data.dimensions = v),
      'blurhash ': (v: string) => (data.blurhash = v),
      'alt ': (v: string) => (data.alt = v),
      'x ': (v: string) => (data.x = v),
      'fallback ': (v: string) => {
        if (!data.fallback) data.fallback = [];
        data.fallback.push(v);
      },
      'image ': (v: string) => {
        if (!data.image) data.image = [];
        data.image.push(v);
      },
      'service ': (v: string) => (data.service = v),
    };

    for (let i = 1; i < imetaTag.length; i++) {
      const part = imetaTag[i];
      for (const [prefix, parser] of Object.entries(parsers)) {
        if (part.startsWith(prefix)) {
          parser(part.substring(prefix.length));
          break;
        }
      }
    }

    return data.url && data.mimeType ? (data as MediaItem) : null;
  }

  parseEvent(event: Event): MediaEvent | null {
    if (event.kind !== 20 && event.kind !== 22) {
      return null;
    }

    const titleTag = event.tags.find((tag) => tag[0] === 'title');
    const title = titleTag ? titleTag[1] : undefined;

    const media: MediaItem[] = [];
    const imetaTags = event.tags.filter((tag) => tag[0] === 'imeta');

    for (const imetaTag of imetaTags) {
      const mediaItem = this.parseImetaTag(imetaTag);
      if (mediaItem) {
        media.push(mediaItem);
      }
    }

    const durationTag = event.tags.find((tag) => tag[0] === 'duration');
    const duration = durationTag ? parseInt(durationTag[1]) : undefined;

    const publishedAtTag = event.tags.find((tag) => tag[0] === 'published_at');
    const published_at = publishedAtTag ? parseInt(publishedAtTag[1]) : undefined;

    return {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      kind: event.kind as 20 | 22,
      content: event.content,
      tags: event.tags,
      title,
      media,
      duration,
      published_at,
    };
  }

  async subscribeToMediaFeed(
    onEvent: (event: MediaEvent) => void,
    onError?: (error: Error) => void
  ): Promise<() => void> {
    const kinds = [20, 22]; // Picture and short video events

    const sub = this.pool.subscribeMany(
      this.relays,
      {
        kinds: kinds,
        limit: 100,
      },
      {
        onevent: (event: Event) => {
          try {
            const mediaEvent = this.parseEvent(event);
            if (mediaEvent && mediaEvent.media && mediaEvent.media.length > 0) {
              onEvent(mediaEvent);
            }
          } catch (error) {
            console.error('Error parsing event:', error);
            onError?.(error as Error);
          }
        },
        onclose: (reasons: string[]) => {
          console.log('Subscription closed:', reasons);
          if (reasons.length > 0) {
            onError?.(new Error(`Relay connection issues: ${reasons.join(', ')}`));
          }
        },
        oneose: () => {
          console.log('End of stored events');
        },
      }
    );

    return () => sub.close();
  }

  private async fetchMediaEvents(
    filter: Record<string, unknown>,
    limit: number
  ): Promise<MediaEvent[]> {
    try {
      const fetchLimit = Math.ceil(limit * 1.5);
      const events = await this.pool.querySync(this.relays, { ...filter, limit: fetchLimit });

      const mediaEvents = events
        .map((event) => this.parseEvent(event))
        .filter((event): event is MediaEvent => event !== null && Boolean(event.media?.length));

      // Deduplicate by ID
      const uniqueEvents = Array.from(new Map(mediaEvents.map((e) => [e.id, e])).values());

      return uniqueEvents.sort((a, b) => b.created_at - a.created_at).slice(0, limit);
    } catch (error) {
      console.error('Error fetching media events:', error);
      return [];
    }
  }

  async getHistoricalMedia(limit: number = 50): Promise<MediaEvent[]> {
    return this.fetchMediaEvents({ kinds: [20, 22] }, limit);
  }

  async getOlderEvents(until: number, limit: number = 30): Promise<MediaEvent[]> {
    return this.fetchMediaEvents({ kinds: [20, 22], until }, limit);
  }

  async getProfileMetadata(pubkey: string): Promise<ProfileMetadata | null> {
    // Check cache first
    if (this.profileCache.has(pubkey)) {
      return this.profileCache.get(pubkey)!;
    }

    try {
      const events = await this.pool.querySync(this.relays, {
        kinds: [0], // Metadata event
        authors: [pubkey],
        limit: 1,
      });

      if (events.length > 0) {
        const event = events[0];
        try {
          const metadata = JSON.parse(event.content) as ProfileMetadata;
          // Cache the result
          this.profileCache.set(pubkey, metadata);
          return metadata;
        } catch (parseError) {
          console.error('Error parsing profile metadata:', parseError);
          return null;
        }
      }

      return null;
    } catch (error) {
      console.error('Error fetching profile metadata:', error);
      return null;
    }
  }

  close(): void {
    this.pool.close(this.relays);
  }
}
