<script lang="ts">
	import type { MediaEvent } from '$lib/types';

	export let event: MediaEvent;

	$: isVideo = event.kind === 22;
	$: primaryMedia = event.media?.[0];
	$: hasMultipleMedia = (event.media?.length || 0) > 1;

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
		{#if primaryMedia}
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