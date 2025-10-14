<script lang="ts">
	import type { MediaEvent } from '$lib/types';
	import { onMount, onDestroy } from 'svelte';

	export let event: MediaEvent;
	export let isActive = false;

	let showJsonOverlay = false;
	let shouldLoadMedia = false;

	// Load media only when item becomes active
	$: if (isActive && !shouldLoadMedia) {
		shouldLoadMedia = true;
	}

	// Unload media when item becomes inactive to save memory
	$: if (!isActive && shouldLoadMedia) {
		// Optional: Keep loaded for better UX, or unload to save memory
		// shouldLoadMedia = false;
	}

	// Media properties (only evaluate when media should be loaded)
	$: isVideo = shouldLoadMedia && event.kind === 22;
	$: primaryMedia = shouldLoadMedia && event.media?.[0];
	$: hasMultipleMedia = shouldLoadMedia && (event.media?.length || 0) > 1;

	function toggleJsonOverlay() {
		showJsonOverlay = !showJsonOverlay;
		
		if (showJsonOverlay) {
			createOverlay();
		} else {
			removeOverlay();
		}
	}

	function getEventJson(): string {
		return JSON.stringify(event, null, 2);
	}

	function createOverlay() {
		// Remove any existing overlay
		removeOverlay();
		
		const overlay = document.createElement('div');
		overlay.className = 'json-overlay-portal';
		overlay.style.cssText = `
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
		`;
		
		const content = document.createElement('div');
		content.className = 'json-content-portal';
		content.style.cssText = `
			background: #1a1a1a;
			border: 1px solid #333;
			border-radius: 12px;
			max-width: 90vw;
			max-height: 90vh;
			width: 600px;
			overflow: hidden;
			box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
		`;
		
		const header = document.createElement('div');
		header.className = 'json-header-portal';
		header.style.cssText = `
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 1rem 1.5rem;
			border-bottom: 1px solid #333;
			background: #222;
		`;
		
		const title = document.createElement('h3');
		title.textContent = 'Event JSON';
		title.style.cssText = `
			margin: 0;
			color: white;
			font-size: 1.1rem;
		`;
		
		const closeBtn = document.createElement('button');
		closeBtn.textContent = '×';
		closeBtn.style.cssText = `
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
		`;
		
		const pre = document.createElement('pre');
		pre.className = 'json-text-portal';
		pre.textContent = getEventJson();
		pre.style.cssText = `
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
		`;
		
		header.appendChild(title);
		header.appendChild(closeBtn);
		content.appendChild(header);
		content.appendChild(pre);
		overlay.appendChild(content);
		
		// Event listeners
		overlay.addEventListener('click', toggleJsonOverlay);
		closeBtn.addEventListener('click', toggleJsonOverlay);
		content.addEventListener('click', (e) => e.stopPropagation());
		
		document.body.appendChild(overlay);
	}

	function removeOverlay() {
		const existing = document.querySelector('.json-overlay-portal');
		if (existing) {
			existing.remove();
		}
	}

	// Cleanup overlay when component is destroyed
	onDestroy(() => {
		removeOverlay();
	});

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
</script>

<div class="media-item">
	<div class="media-container">
		{#if shouldLoadMedia && primaryMedia}
			{#if isVideo}
				<video 
					class="media"
					controls
					autoplay
					muted
					loop
					playsinline
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
					src={primaryMedia.url}
					alt={primaryMedia.alt || event.content}
					on:error={(e) => {
						const img = e.target as HTMLImageElement;
						if (primaryMedia.fallback && primaryMedia.fallback.length > 0) {
							img.src = primaryMedia.fallback[0];
						}
					}}
				/>
			{/if}
		{:else}
			<!-- Placeholder for unloaded media -->
			<div class="media-placeholder">
				<div class="placeholder-content">
					<div class="placeholder-icon">📷</div>
					<p>Loading media...</p>
				</div>
			</div>
		{/if}

		{#if shouldLoadMedia && hasMultipleMedia}
			<div class="media-indicator">
				{event.media?.length} items
			</div>
		{/if}

		{#if shouldLoadMedia && isVideo && event.duration}
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
				{#if event.published_at}
					<span class="published">Published {formatTimeAgo(event.published_at)}</span>
				{/if}
			</div>
		</div>

		{#if event.content}
			<div class="description">
				<p>{event.content}</p>
			</div>
		{/if}

		<div class="footer">
			<div class="author">
				<div class="author-avatar">
					{event.pubkey.slice(0, 2).toUpperCase()}
				</div>
				<div class="author-info">
					<div class="author-name">
						{event.pubkey.slice(0, 8)}...{event.pubkey.slice(-8)}
					</div>
					<div class="author-id">{event.pubkey}</div>
				</div>
			</div>
			<button class="json-button" on:click={toggleJsonOverlay} title="View JSON">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z"/>
					<path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
					<path d="M2 12h20"/>
				</svg>
			</button>
		</div>
	</div>
</div>

<style>
	.media-item {
		height: 100vh;
		width: 100vw;
		position: relative;
		background: #000;
		display: flex;
		align-items: center;
		justify-content: center;
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
		padding: 2rem;
		color: white;
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
	}

	.description p {
		line-height: 1.4;
		font-size: 0.95rem;
	}

	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.author {
		display: flex;
		align-items: center;
		gap: 0.75rem;
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
	}

	.author-name {
		font-weight: 500;
		font-size: 0.9rem;
	}

	.author-id {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.5);
		font-family: monospace;
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

	@media (max-width: 768px) {
		.content-overlay {
			padding: 1rem;
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
	}
</style>