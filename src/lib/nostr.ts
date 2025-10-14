import { SimplePool, type Event } from 'nostr-tools';
import { getConfig } from './config';
import type { MediaEvent, MediaItem, ImetaData } from './types';

export class NostrService {
  private pool: SimplePool;
  private relays: string[];

  constructor() {
    this.pool = new SimplePool();
    const config = getConfig();
    this.relays = config.relays;
  }

  async connect(): Promise<void> {
    const connectionPromises = this.relays.map(async (relay) => {
      try {
        await this.pool.ensureRelay(relay);
        console.log(`Connected to relay: ${relay}`);
        return { relay, success: true };
      } catch (error) {
        console.error(`Failed to connect to relay ${relay}:`, error);
        return { relay, success: false, error };
      }
    });

    const results = await Promise.allSettled(connectionPromises);
    const failedConnections = results.filter(
      (result): result is PromiseFulfilledResult<{ relay: string; success: false; error: any }> =>
        result.status === 'fulfilled' && !result.value.success
    );

    if (failedConnections.length === this.relays.length) {
      throw new Error('Failed to connect to any relay');
    }

    if (failedConnections.length > 0) {
      console.warn(`Failed to connect to ${failedConnections.length} relays`);
    }
  }

  parseImetaTag(imetaTag: string[]): MediaItem | null {
    const data: ImetaData = {};

    for (let i = 1; i < imetaTag.length; i++) {
      const part = imetaTag[i];
      if (part.startsWith('url ')) {
        data.url = part.substring(4);
      } else if (part.startsWith('m ')) {
        data.mimeType = part.substring(2);
      } else if (part.startsWith('dim ')) {
        data.dimensions = part.substring(4);
      } else if (part.startsWith('blurhash ')) {
        data.blurhash = part.substring(9);
      } else if (part.startsWith('alt ')) {
        data.alt = part.substring(4);
      } else if (part.startsWith('x ')) {
        data.x = part.substring(2);
      } else if (part.startsWith('fallback ')) {
        if (!data.fallback) data.fallback = [];
        data.fallback.push(part.substring(9));
      } else if (part.startsWith('image ')) {
        if (!data.image) data.image = [];
        data.image.push(part.substring(6));
      } else if (part.startsWith('service ')) {
        data.service = part.substring(8);
      }
    }

    if (!data.url || !data.mimeType) {
      return null;
    }

    return {
      url: data.url,
      mimeType: data.mimeType,
      dimensions: data.dimensions,
      blurhash: data.blurhash,
      alt: data.alt,
      x: data.x,
      fallback: data.fallback,
      image: data.image,
      service: data.service,
    };
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

  async getHistoricalMedia(limit: number = 50): Promise<MediaEvent[]> {
    try {
      const kinds = [20, 22]; // Picture and short video events

      const events = await this.pool.querySync(this.relays, {
        kinds: kinds,
        limit: limit,
      });

      const mediaEvents: MediaEvent[] = [];
      for (const event of events) {
        const mediaEvent = this.parseEvent(event);
        if (mediaEvent && mediaEvent.media && mediaEvent.media.length > 0) {
          mediaEvents.push(mediaEvent);
        }
      }

      return mediaEvents.sort((a, b) => b.created_at - a.created_at);
    } catch (error) {
      console.error('Error fetching historical media:', error);
      return [];
    }
  }

  close(): void {
    this.pool.close(this.relays);
  }
}
