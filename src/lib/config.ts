export interface Config {
  relays: string[];
}

const defaultRelays = [
  'wss://nostr.wine',
  'wss://nostr.data.haus',
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.snort.social',
];

export function getConfig(): Config {
  // Check for environment variable first (for Docker)
  const envRelays = import.meta.env.VITE_NOSTR_RELAYS;
  if (envRelays) {
    return {
      relays: envRelays
        .split(',')
        .map((r: string) => r.trim())
        .filter((r: string) => r.startsWith('wss://')),
    };
  }

  // Fallback to default relays
  return {
    relays: defaultRelays,
  };
}
