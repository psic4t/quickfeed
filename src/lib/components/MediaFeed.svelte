<script lang="ts">
	import { onMount } from 'svelte';
	import type { MediaEvent } from '$lib/types';
	import MediaItem from './MediaItem.svelte';

	export let mediaEvents: MediaEvent[] = [];
	export let onLoadMore: () => void = () => {};
	export let isLoadingMore = false;
	export let hasMoreEvents = true;

	let currentIndex = 0;
	let container: HTMLElement;
	let isScrolling = false;
	let touchStartY = 0;
	let touchEndY = 0;
	let isDragging = false;
	let loadMoreTriggered = false;

	// Check if we should load more events
	$: if (hasMoreEvents && !isLoadingMore && !loadMoreTriggered && 
		(currentIndex >= mediaEvents.length - 3)) { // Load when 3 items from end
		loadMoreTriggered = true;
		onLoadMore();
	}

	function scrollToIndex(index: number) {
		if (isScrolling || index < 0 || index >= mediaEvents.length) return;
		
		isScrolling = true;
		currentIndex = index;
		
		// Reset load more trigger when scrolling away from end
		if (index < mediaEvents.length - 3) {
			loadMoreTriggered = false;
		}
		
		const item = container?.children[index] as HTMLElement;
		if (item) {
			// Use smooth scrolling animation
			container?.scrollTo({
				top: item.offsetTop,
				behavior: 'smooth'
			});
		}
		
		// Allow more time for smooth animation to complete
		setTimeout(() => {
			isScrolling = false;
		}, 150);
	}

	function handleWheel(event: WheelEvent) {
		if (isScrolling) return;
		
		event.preventDefault();
		
		if (event.deltaY > 0) {
			scrollToIndex(currentIndex + 1);
		} else {
			scrollToIndex(currentIndex - 1);
		}
	}

	function handleTouchStart(event: TouchEvent) {
		touchStartY = event.touches[0].clientY;
		isDragging = true;
	}

	function handleTouchMove(event: TouchEvent) {
		if (!isDragging) return;
		touchEndY = event.touches[0].clientY;
	}

	function handleTouchEnd(event: TouchEvent) {
		if (!isDragging) return;
		
		const deltaY = touchStartY - touchEndY;
		const minSwipeDistance = 50;
		
		if (Math.abs(deltaY) > minSwipeDistance) {
			if (deltaY > 0) {
				// Swipe up - next item
				scrollToIndex(currentIndex + 1);
			} else {
				// Swipe down - previous item
				scrollToIndex(currentIndex - 1);
			}
		}
		
		isDragging = false;
	}



	onMount(() => {
		if (container) {
			container.addEventListener('wheel', handleWheel, { passive: false });
			container.addEventListener('touchstart', handleTouchStart, { passive: true });
			container.addEventListener('touchmove', handleTouchMove, { passive: true });
			container.addEventListener('touchend', handleTouchEnd, { passive: true });
			

		}
		
		return () => {
			if (container) {
				container.removeEventListener('wheel', handleWheel);
				container.removeEventListener('touchstart', handleTouchStart);
				container.removeEventListener('touchmove', handleTouchMove);
				container.removeEventListener('touchend', handleTouchEnd);
				

			}

		};
	});

	// Scroll to latest event
	function scrollToLatest() {
		scrollToIndex(0);
	}

	// Keyboard navigation
	function handleKeydown(keyboardEvent: KeyboardEvent) {
		switch (keyboardEvent.key) {
			case 'ArrowDown':
			case 'j':
				scrollToIndex(currentIndex + 1);
				break;
			case 'ArrowUp':
			case 'k':
				scrollToIndex(currentIndex - 1);
				break;
			case 'Home':
				scrollToLatest();
				break;
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if currentIndex > 0}
	<button class="back-to-latest" on:click={scrollToLatest} title="Back to latest">
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M18 15l-6-6-6 6"/>
		</svg>
	</button>
{/if}

<div 
	class="feed-container" 
	bind:this={container}
	style="touch-action: pan-y;"
>
		{#each mediaEvents as event, index}
			<div class="feed-item" class:active={index === currentIndex} style="contain: strict;">
				<MediaItem {event} isActive={index === currentIndex} />
			</div>
		{/each}
		
		{#if isLoadingMore}
			<div class="loading-more">
				<div class="spinner"></div>
				<p>Loading more...</p>
			</div>
		{/if}
</div>



<style>
	.feed-container {
		height: 100vh;
		width: 100vw;
		overflow-y: hidden;
		overflow-x: hidden;
		scroll-snap-type: y mandatory;
		scroll-behavior: smooth;
	}

	.feed-item {
		height: 100vh;
		width: 100vw;
		scroll-snap-align: start;
		position: relative;
		overflow-x: hidden;
		contain: layout style paint;
		will-change: transform;
		transform: translateZ(0);
		transition: opacity 0.1s ease;
	}

	.feed-item:not(.active) {
		opacity: 0.95;
	}

	.loading-more {
		height: 100vh;
		width: 100vw;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		color: rgba(255, 255, 255, 0.7);
		scroll-snap-align: start;
	}

	.loading-more .spinner {
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

	.back-to-latest {
		position: fixed;
		top: 20px;
		left: 20px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: white;
		padding: 8px;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.1s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.back-to-latest:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.3);
		transform: scale(1.05);
	}


</style>