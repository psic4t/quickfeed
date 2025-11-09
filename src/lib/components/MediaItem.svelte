<script lang="ts">
	import type { MediaEvent } from '$lib/types';
	import type { ProfileMetadata } from '$lib/nostr';
	import { onMount, onDestroy } from 'svelte';
	import { nip19 } from 'nostr-tools';

	interface Props {
		event: MediaEvent;
		isActive: boolean;
	}

	let {
		event,
		isActive = false
	}: Props = $props();

	let showJsonOverlay = $state(false);
	let profileMetadata: ProfileMetadata | null = $state(null);
	let mediaElement = $state<HTMLImageElement | HTMLVideoElement>();

	// Convert pubkey to npub format
	const npub = $derived(nip19.npubEncode(event.pubkey));

	// Track the pubkey of the last loaded profile
	let lastLoadedPubkey: string | null = $state(null);

	// Reset profile metadata when event changes to a different pubkey
	$effect(() => {
		if (lastLoadedPubkey && lastLoadedPubkey !== event.pubkey) {
			profileMetadata = null;
			lastLoadedPubkey = null;
		}
	});

	// Load profile metadata when component becomes active or event changes (with debouncing)
	let profileLoadTimeout: number;
	$effect(() => {
		if (isActive && (!profileMetadata || lastLoadedPubkey !== event.pubkey)) {
			if (profileLoadTimeout) clearTimeout(profileLoadTimeout);
			profileLoadTimeout = setTimeout(loadProfileMetadata, 100);
		}
	});

	async function loadProfileMetadata() {
		try {
			// Import NostrService dynamically to avoid circular dependencies
			const { NostrService } = await import('$lib/nostr');
			const nostrService = new NostrService();
			await nostrService.connect();
			profileMetadata = await nostrService.getProfileMetadata(event.pubkey);
			lastLoadedPubkey = event.pubkey; // Track which pubkey we loaded
			nostrService.close();
		} catch (error) {
			console.error('Error loading profile metadata:', error);
		}
	}

	onDestroy(() => {
		if (profileLoadTimeout) {
			clearTimeout(profileLoadTimeout);
		}
	});

	// Media properties
	const isVideo = $derived(event.kind === 22);
	const primaryMedia = $derived(event.media?.[0]);
	const hasMultipleMedia = $derived((event.media?.length || 0) > 1);

	function toggleJsonOverlay() {
		showJsonOverlay = !showJsonOverlay;
	}

	function getEventJson(): string {
		return JSON.stringify(event, null, 2);
	}

	function formatTimeAgo(timestamp: number): string {
		const now = Math.floor(Date.now() / 1000);
		const diff = now - timestamp;
		
		if (diff < 60) return 'just now';
		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
		return `${Math.floor(diff / 86400)}d ago`;
	}

	function formatDuration(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function handleVideoError() {
		console.error('Video failed to load:', event.media?.[0]?.url || 'unknown URL');
	}

	function parseDescriptionWithTags(text: string) {
		// Regex to find hashtags (words starting with #)
		const hashtagRegex = /#(\w+)/g;
		const parts = [];
		let lastIndex = 0;
		let match;

		while ((match = hashtagRegex.exec(text)) !== null) {
			// Add text before the hashtag
			if (match.index > lastIndex) {
				parts.push({
					type: 'text',
					content: text.slice(lastIndex, match.index)
				});
			}
			
			// Add the hashtag
			parts.push({
				type: 'tag',
				content: match[1] // without the #
			});
			
			lastIndex = match.index + match[0].length;
		}
		
		// Add remaining text
		if (lastIndex < text.length) {
			parts.push({
				type: 'text',
				content: text.slice(lastIndex)
			});
		}
		
		return parts;
	}

	function navigateToTag(tagName: string) {
		const url = new URL(window.location.href);
		url.searchParams.set('tag', tagName);
		window.location.href = url.toString();
	}

	function navigateToUser(username: string) {
		const url = new URL(window.location.href);
		url.searchParams.set('user', username);
		window.location.href = url.toString();
	}
</script>

<div class="media-item">
	<!-- Mobile fixed header -->
	<div class="mobile-fixed-header">
		<div class="mobile-author">
			<div class="mobile-author-avatar">
				{#if profileMetadata?.picture}
					<img src={profileMetadata.picture} alt="Profile" class="mobile-profile-image" />
				{:else}
					{event.pubkey.slice(0, 2).toUpperCase()}
				{/if}
			</div>
			<button 
				class="mobile-author-name" 
				onclick={() => navigateToUser(event.pubkey)}
				title="Filter by this user"
			>
				{profileMetadata?.display_name || profileMetadata?.name || `${event.pubkey.slice(0, 6)}...`}
			</button>
		</div>
		<button class="mobile-json-button" onclick={toggleJsonOverlay} title="View JSON">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z"/>
				<path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
				<path d="M2 12h20"/>
			</svg>
		</button>
	</div>

	<div class="media-container">
		{#if primaryMedia}
			{#if isVideo}
				<video 
					class="media"
					bind:this={mediaElement}
					controls
					autoplay={isActive}
					muted
					loop
					playsinline
					preload="metadata"
					onerror={handleVideoError}
					oncanplay={() => {
						if (isActive && mediaElement && mediaElement instanceof HTMLVideoElement) {
							mediaElement.play().catch((e: any) => console.log('Autoplay prevented:', e));
						}
					}}
				>
					<source src={primaryMedia.url} type={primaryMedia.mimeType} />
					{#each primaryMedia.fallback || [] as fallbackUrl}
						<source src={fallbackUrl} type={primaryMedia.mimeType} />
					{/each}
					<p>Your browser doesn't support video playback.</p>
				</video>
			{:else}
				<img 
					class="media"
					bind:this={mediaElement}
					src={primaryMedia.url}
					alt={primaryMedia.alt || event.content}
					loading="lazy"
					decoding="async"
					onerror={(e) => {
						const img = e.target as HTMLImageElement;
						if (primaryMedia.fallback && primaryMedia.fallback.length > 0) {
							img.src = primaryMedia.fallback[0];
						}
					}}
				/>
			{/if}
		{:else}
			<!-- No media available -->
			<div class="media-placeholder">
				<div class="placeholder-content">
					<div class="placeholder-icon">📷</div>
					<p>No media available</p>
				</div>
			</div>
		{/if}

		{#if hasMultipleMedia}
			<div class="media-indicator">
				{event.media?.length} items
			</div>
		{/if}

		{#if isVideo && event.duration}
			<div class="duration">
				{formatDuration(event.duration)}
			</div>
		{/if}
	</div>

	<div class="content-overlay">
		<div class="header">
			{#if event.title}
				<h2 class="title">{event.title}</h2>
			{/if}
			<div class="meta">
				<span class="time">{formatTimeAgo(event.created_at)}</span>
			</div>
		</div>

		{#if event.content}
			<div class="description">
				{#each parseDescriptionWithTags(event.content) as part}
					{#if part.type === 'tag'}
						<button 
							class="hashtag" 
							onclick={() => navigateToTag(part.content)}
							title="Filter by #{part.content}"
						>
							#{part.content}
						</button>
					{:else}
						<span>{part.content}</span>
					{/if}
				{/each}
			</div>
		{/if}

		<div class="footer">
			<div class="author">
				<div class="author-avatar">
					{#if profileMetadata?.picture}
						<img src={profileMetadata.picture} alt="Profile" class="profile-image" />
					{:else}
						{event.pubkey.slice(0, 2).toUpperCase()}
					{/if}
				</div>
				<div class="author-info">
					<button 
						class="author-name" 
						onclick={() => navigateToUser(event.pubkey)}
						title="Filter by this user"
					>
						{profileMetadata?.display_name || profileMetadata?.name || `${event.pubkey.slice(0, 8)}...${event.pubkey.slice(-8)}`}
					</button>
					<div class="author-id">{npub}</div>
				</div>
			</div>
			<button class="json-button" onclick={toggleJsonOverlay} title="View JSON">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z"/>
					<path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
					<path d="M2 12h20"/>
				</svg>
			</button>
		</div>
	</div>
</div>

{#if showJsonOverlay}
	<div 
		class="json-overlay" 
		role="dialog" 
		aria-modal="true"
		aria-labelledby="json-title"
		tabindex="-1"
		onclick={toggleJsonOverlay}
		onkeydown={(e) => e.key === 'Escape' && toggleJsonOverlay()}
	>
		<div class="json-content" role="document">
			<div class="json-header">
				<h3 id="json-title">Event JSON</h3>
				<button class="json-close" onclick={(e) => {
					e.stopPropagation();
					toggleJsonOverlay();
				}} aria-label="Close JSON view">×</button>
			</div>
			<pre class="json-text">{getEventJson()}</pre>
		</div>
	</div>
{/if}

<style>
	/* CSS custom properties for safe areas */
	:root {
		--safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
		--mobile-browser-height: 60px; /* Estimated browser bar height */
	}

	.media-item {
		height: 100dvh; /* Dynamic viewport height */
		width: 100vw;
		position: relative;
		background: #000;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow-x: hidden;
	}

	.media-container {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.media {
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
	}

	.media-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #111;
	}

	.placeholder-content {
		text-align: center;
		color: rgba(255, 255, 255, 0.5);
	}

	.placeholder-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.media-indicator {
		position: absolute;
		top: 20px;
		right: 20px;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		padding: 8px 12px;
		border-radius: 20px;
		font-size: 12px;
		backdrop-filter: blur(10px);
	}

	.duration {
		position: absolute;
		bottom: 20px;
		right: 20px;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		backdrop-filter: blur(10px);
	}

	.content-overlay {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.9), transparent);
		padding: 2rem 2rem calc(2rem + var(--safe-area-inset-bottom) + var(--mobile-browser-height));
		color: white;
		overflow-x: hidden;
	}

	.header {
		margin-bottom: 1rem;
	}

	.title {
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
		line-height: 1.2;
	}

	.meta {
		display: flex;
		gap: 1rem;
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.7);
	}

	.description {
		margin-bottom: 1.5rem;
		max-width: 600px;
		line-height: 1.4;
		font-size: 0.95rem;
	}

	.hashtag {
		background: rgba(102, 126, 234, 0.2);
		border: 1px solid rgba(102, 126, 234, 0.3);
		color: #667eea;
		padding: 2px 6px;
		border-radius: 4px;
		cursor: pointer;
		font-size: inherit;
		font-family: inherit;
		transition: all 0.2s ease;
		margin: 0 2px;
	}

	.hashtag:hover {
		background: rgba(102, 126, 234, 0.3);
		border-color: rgba(102, 126, 234, 0.5);
		color: #7ba7f7;
		text-decoration: underline;
	}

	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		max-width: 100%;
	}

	.author {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: 1;
		min-width: 0; /* Important for flexbox truncation */
	}

	.author-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 14px;
		overflow: hidden;
	}

	.profile-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.author-info {
		flex: 1;
		min-width: 0; /* Important for text truncation */
	}

	.author-name {
		font-weight: 500;
		font-size: 0.9rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 200px;
		background: none;
		border: none;
		color: white;
		cursor: pointer;
		padding: 0;
		text-align: left;
		font-family: inherit;
		transition: color 0.2s ease;
	}

	.author-name:hover {
		color: #667eea;
		text-decoration: underline;
	}

	.author-id {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.5);
		font-family: monospace;
		word-break: break-all;
		overflow-wrap: break-word;
		max-width: 280px; /* Optimized for 63-character npub addresses */
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.json-button {
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: white;
		padding: 8px;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.json-button:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.3);
		transform: scale(1.05);
	}

	/* Mobile fixed header */
	.mobile-fixed-header {
		display: none;
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 60px;
		background: rgba(0, 0, 0, 0.8);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		z-index: 1000;
		align-items: center;
		justify-content: space-between;
		padding: 0 1rem;
	}

	.mobile-author {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: 1;
		min-width: 0;
	}

	.mobile-author-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 12px;
		overflow: hidden;
		flex-shrink: 0;
	}

	.mobile-profile-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.mobile-author-name {
		font-weight: 500;
		font-size: 0.9rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 200px;
		background: none;
		border: none;
		color: white;
		cursor: pointer;
		padding: 0;
		text-align: left;
		font-family: inherit;
		transition: color 0.2s ease;
	}

	.mobile-author-name:hover {
		color: #667eea;
		text-decoration: underline;
	}

	.mobile-json-button {
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: white;
		padding: 8px;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.mobile-json-button:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.3);
		transform: scale(1.05);
	}

	/* JSON Modal */
	.json-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		backdrop-filter: blur(4px);
	}

	.json-content {
		background: #1a1a1a;
		border: 1px solid #333;
		border-radius: 12px;
		max-width: 90vw;
		max-height: 90vh;
		width: 600px;
		overflow: hidden;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
	}

	.json-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid #333;
		background: #222;
	}

	.json-header h3 {
		margin: 0;
		color: white;
		font-size: 1.1rem;
	}

	.json-close {
		background: none;
		border: none;
		color: #999;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0;
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s ease;
	}

	.json-close:hover {
		color: white;
		background: rgba(255, 255, 255, 0.1);
	}

	.json-text {
		padding: 1.5rem;
		margin: 0;
		color: #e0e0e0;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.85rem;
		line-height: 1.4;
		overflow: auto;
		max-height: calc(90vh - 80px);
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	@media (max-width: 768px) {
		.mobile-fixed-header {
			display: none; /* Hide the fixed header, keep bottom overlay */
		}

		.media-item {
			padding-top: 0; /* Remove padding since no fixed header */
		}

		.media-container {
			height: 100vh; /* Full height since no fixed header */
		}

		.content-overlay {
			padding: 1rem 1rem calc(1rem + var(--safe-area-inset-bottom) + var(--mobile-browser-height));
		}

		.title {
			font-size: 1.2rem;
		}

		.description {
			font-size: 0.9rem;
		}

		.author-avatar {
			width: 32px;
			height: 32px;
			font-size: 12px;
		}

		.footer {
			flex-wrap: wrap;
			gap: 0.5rem;
		}

		.json-button {
			flex-shrink: 0;
			padding: 6px;
			min-width: 36px;
			min-height: 36px;
		}

		.author-name {
			max-width: 150px;
		}

		.json-content {
			width: 95vw;
			max-height: 95vh;
		}

		.json-text {
			font-size: 0.8rem;
			padding: 1rem;
		}
	}
</style>
