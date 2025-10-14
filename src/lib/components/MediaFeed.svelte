<script lang="ts">
	import { onMount } from 'svelte';
	import type { MediaEvent } from '$lib/types';
	import MediaItem from './MediaItem.svelte';

	export let mediaEvents: MediaEvent[] = [];

	let currentIndex = 0;
	let container: HTMLElement;
	let isScrolling = false;
	let touchStartY = 0;
	let touchEndY = 0;
	let isDragging = false;

	function scrollToIndex(index: number) {
		if (isScrolling || index < 0 || index >= mediaEvents.length) return;
		
		isScrolling = true;
		currentIndex = index;
		
		const item = container?.children[index] as HTMLElement;
		if (item) {
			item.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
		
		setTimeout(() => {
			isScrolling = false;
		}, 500);
	}

	function handleWheel(event: WheelEvent) {
		if (isScrolling) return;
		
		event.preventDefault();
		
		if (event.deltaY > 0) {
			// Scroll down
			scrollToIndex(currentIndex + 1);
		} else {
			// Scroll up
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
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div 
	class="feed-container" 
	bind:this={container}
	style="touch-action: pan-y;"
>
	{#each mediaEvents as event, index}
		<div class="feed-item" class:active={index === currentIndex}>
			<MediaItem {event} isActive={index === currentIndex} />
		</div>
	{/each}
</div>

{#if mediaEvents.length > 0}
	<div class="navigation">
		<div class="nav-indicators">
		{#each mediaEvents as _, index}
			<button 
				class="indicator" 
				class:active={index === currentIndex}
				on:click={() => scrollToIndex(index)}
				aria-label={`Go to item ${index + 1}`}
			></button>
		{/each}
		</div>
		<div class="nav-info">
			{currentIndex + 1} / {mediaEvents.length}
		</div>
	</div>
{/if}

<style>
	.feed-container {
		height: 100vh;
		width: 100vw;
		overflow-y: hidden;
		scroll-snap-type: y mandatory;
		scroll-behavior: smooth;
	}

	.feed-item {
		height: 100vh;
		width: 100vw;
		scroll-snap-align: start;
		position: relative;
	}

	.navigation {
		position: fixed;
		right: 20px;
		top: 50%;
		transform: translateY(-50%);
		z-index: 100;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.nav-indicators {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.3);
		cursor: pointer;
		transition: all 0.2s ease;
		border: none;
		padding: 0;
	}

	.indicator.active {
		background: #fff;
		transform: scale(1.2);
	}

	.nav-info {
		color: rgba(255, 255, 255, 0.7);
		font-size: 12px;
		margin-top: 0.5rem;
	}

	@media (max-width: 768px) {
		.navigation {
			right: 10px;
		}
		
		.indicator {
			width: 6px;
			height: 6px;
		}
	}
</style>