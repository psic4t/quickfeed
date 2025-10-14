<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { NostrService } from '$lib/nostr';
	import type { MediaEvent } from '$lib/types';
	import MediaFeed from '$lib/components/MediaFeed.svelte';
	import { PerformanceMonitor } from '$lib/performance';

	let nostrService: NostrService;
	let mediaEvents: MediaEvent[] = [];
	let filteredEvents: MediaEvent[] = [];
	let isConnecting = true;
	let error: string | null = null;
	let connectionStatus: 'connecting' | 'connected' | 'error' | 'loading' = 'connecting';
	let isLoadingHistorical = false;
	let isLoadingMore = false;
	let hasMoreEvents = true;
	let oldestLoadedTimestamp: number | null = null;
	let currentTag: string | null = null;
	let currentUser: string | null = null;
	let seenEventIds: Set<string> = new Set();

	// Filter events by tag
	function filterEventsByTag(events: MediaEvent[], tag: string | null): MediaEvent[] {
		if (!tag) return events;
		
		return events.filter(event => {
			// Check if any tag matches the filter
			return event.tags.some(tagArray => 
				tagArray[0] === 't' && tagArray[1] === tag
			);
		});
	}

	// Filter events by user
	function filterEventsByUser(events: MediaEvent[], user: string | null): MediaEvent[] {
		if (!user) return events;
		
		return events.filter(event => {
			// Check if pubkey matches the user filter
			return event.pubkey === user;
		});
	}

	// Update filtered events when mediaEvents, tag, or user changes
	$: filteredEvents = currentUser 
		? filterEventsByUser(mediaEvents, currentUser)
		: filterEventsByTag(mediaEvents, currentTag);

	// Update current tag and user when URL changes
	$: currentTag = $page.url.searchParams.get('tag');
	$: currentUser = $page.url.searchParams.get('user');

	// Load more events function with retry logic
	async function loadMoreEvents(retryCount = 0) {
		if (isLoadingMore || !hasMoreEvents || !oldestLoadedTimestamp) return;
		
		isLoadingMore = true;
		
		try {
			const olderEvents = await nostrService.getOlderEvents(oldestLoadedTimestamp, 30);
			
			if (olderEvents.length === 0) {
				hasMoreEvents = false;
			} else {
				// Filter out events we've already seen
				const newEvents = olderEvents.filter(event => !seenEventIds.has(event.id));
				
				if (newEvents.length > 0) {
					// Add to seen set
					newEvents.forEach(event => seenEventIds.add(event.id));
					
					// Update oldest timestamp
					oldestLoadedTimestamp = Math.min(...newEvents.map(e => e.created_at));
					
					// Append to existing events (maintaining chronological order)
					mediaEvents = [...mediaEvents, ...newEvents];
				} else {
					// All events were duplicates, try fetching more with older timestamp
					if (retryCount < 3) {
						// Move timestamp back further and retry
						oldestLoadedTimestamp = oldestLoadedTimestamp - 86400; // Go back 1 day
						setTimeout(() => loadMoreEvents(retryCount + 1), 1000);
						return;
					} else {
						hasMoreEvents = false;
					}
				}
			}
		} catch (err) {
			console.error('Error loading more events:', err);
			
			// Retry logic with exponential backoff
			if (retryCount < 3) {
				const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
				setTimeout(() => loadMoreEvents(retryCount + 1), delay);
			} else {
				error = 'Failed to load more events. Please try again later.';
				// Clear error after 5 seconds
				setTimeout(() => error = null, 5000);
			}
		} finally {
			isLoadingMore = false;
		}
	}

	onMount(async () => {
		const endTimer = PerformanceMonitor.startTimer('page-initialization');
		
		try {
			connectionStatus = 'connecting';
			nostrService = new NostrService();
			await nostrService.connect();
			connectionStatus = 'connected';
			
			// Load historical events asynchronously
			connectionStatus = 'loading';
			
			// Start loading historical media in background
			const historicalTimer = PerformanceMonitor.startTimer('load-historical-media');
			nostrService.getHistoricalMedia(30) // Request more events to account for deduplication
				.then(historical => {
					historicalTimer();
					// Add all historical events to seen set and sort by created_at timestamp (newest first)
					historical.forEach(event => seenEventIds.add(event.id));
					mediaEvents = historical.sort((a, b) => b.created_at - a.created_at);
					
					// Set oldest timestamp for pagination
					if (mediaEvents.length > 0) {
						oldestLoadedTimestamp = Math.min(...mediaEvents.map(e => e.created_at));
					}
					
					connectionStatus = 'connected';
				})
				.catch(err => {
					historicalTimer();
					console.error('Error loading historical media:', err);
					error = 'Failed to load historical media';
					connectionStatus = 'error';
				});
			
			// Subscribe to new events
			nostrService.subscribeToMediaFeed(
				(event) => {
					const eventTimer = PerformanceMonitor.startTimer('process-new-event');
					// Check if we've already seen this event
					if (seenEventIds.has(event.id)) {
						eventTimer();
						return; // Skip duplicate
					}
					
					// Mark as seen and add to events
					seenEventIds.add(event.id);
					const newEvents = [event, ...mediaEvents];
					newEvents.sort((a, b) => b.created_at - a.created_at);
					mediaEvents = newEvents.slice(0, 100);
					eventTimer();
				},
				(err) => {
					error = err.message;
					connectionStatus = 'error';
				}
			);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to connect to Nostr';
			connectionStatus = 'error';
		} finally {
			isConnecting = false;
			endTimer();
			
			// Log performance metrics in development
			if (import.meta.env.DEV) {
				setTimeout(() => {
					console.log('Performance Metrics:');
					PerformanceMonitor.logMetrics();
				}, 5000);
			}
		}
	});

	onDestroy(() => {
		nostrService?.close();
	});
</script>

<main>
	{#if isConnecting}
		<div class="loading">
			<div class="spinner"></div>
			<p>Connecting to Nostr...</p>
		</div>
		{:else if connectionStatus === 'loading' && mediaEvents.length === 0}
		<div class="loading">
			<div class="spinner"></div>
			<p>Loading media from Nostr relays...</p>
		</div>
	{:else if error}
		<div class="error">
			<h2>Connection Error</h2>
			<p>{error}</p>
			<button class="retry-button" on:click={() => window.location.reload()}>
				Try Again
			</button>
		</div>
		{:else if filteredEvents.length === 0}
			<div class="empty-state">
				<h2>No Media Found</h2>
				{#if currentTag}
					<p>No media events found with tag "#{currentTag}".</p>
				{:else if currentUser}
					<p>No media events found for this user.</p>
				{:else}
					<p>No media events found on the connected relays.</p>
				{/if}
			</div>
		{:else}
			{#if currentTag}
				<div class="filter-info">
					<span>Filtered by tag: <strong>#{currentTag}</strong></span>
					<a href="/" class="clear-filter">Clear filter</a>
				</div>
			{:else if currentUser}
				<div class="filter-info">
					<span>Filtered by user</span>
					<a href="/" class="clear-filter">Clear filter</a>
				</div>
			{/if}
			<MediaFeed 
				mediaEvents={filteredEvents} 
				onLoadMore={loadMoreEvents}
				{isLoadingMore}
				{hasMoreEvents}
			/>
	{/if}
</main>

<style>
	main {
		height: 100vh;
		width: 100vw;
		position: relative;
		overflow-x: hidden;
	}

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		gap: 1rem;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid #333;
		border-top: 3px solid #fff;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		text-align: center;
		padding: 2rem;
	}

	.error h2 {
		color: #ff6b6b;
		margin-bottom: 1rem;
	}

	.retry-button {
		background: #667eea;
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 8px;
		cursor: pointer;
		font-size: 1rem;
		margin-top: 1rem;
		transition: background-color 0.2s ease;
	}

	.retry-button:hover {
		background: #5a6fd8;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		text-align: center;
		padding: 2rem;
		color: rgba(255, 255, 255, 0.7);
	}



	.filter-info {
		position: fixed;
		top: 20px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(0, 0, 0, 0.9);
		color: white;
		padding: 0.75rem 1.5rem;
		border-radius: 20px;
		display: flex;
		align-items: center;
		gap: 1rem;
		backdrop-filter: blur(10px);
		z-index: 100;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.clear-filter {
		color: #667eea;
		text-decoration: none;
		font-size: 0.9rem;
		transition: color 0.2s ease;
	}

	.clear-filter:hover {
		color: #5a6fd8;
		text-decoration: underline;
	}
</style>