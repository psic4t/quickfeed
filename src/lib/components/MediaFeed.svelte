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
	let wheelTimeout: number;
	
	// Virtual scrolling - only render items near current index
	const BUFFER_SIZE = 2; // Render 2 items before and after current
	$: visibleStartIndex = Math.max(0, currentIndex - BUFFER_SIZE);
	$: visibleEndIndex = Math.min(mediaEvents.length - 1, currentIndex + BUFFER_SIZE);
	$: visibleEvents = mediaEvents.slice(visibleStartIndex, visibleEndIndex + 1);

	function scrollToIndex(index: number) {
		if (isScrolling || index < 0 || index >= mediaEvents.length) return;
		
		isScrolling = true;
		currentIndex = index;
		
		const item = container?.children[index] as HTMLElement;
		if (item) {
			// Use instant scrolling for faster response
			container?.scrollTo(0, item.offsetTop);
		}
		
		// Reduce timeout for better responsiveness
		setTimeout(() => {
			isScrolling = false;
		}, 100);
	}

	function handleWheel(event: WheelEvent) {
		if (isScrolling) return;
		
		event.preventDefault();
		
		// Debounce wheel events for better performance
		if (wheelTimeout) clearTimeout(wheelTimeout);
		
		wheelTimeout = setTimeout(() => {
			if (event.deltaY > 0) {
				// Scroll down
				scrollToIndex(currentIndex + 1);
			} else {
				// Scroll up
				scrollToIndex(currentIndex - 1);
			}
		}, 8); // ~120fps for faster response
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
			
			// Optimize scroll performance
			container.style.willChange = 'transform';
			container.style.transform = 'translateZ(0)';
		}
		
		return () => {
			if (container) {
				container.removeEventListener('wheel', handleWheel);
				container.removeEventListener('touchstart', handleTouchStart);
				container.removeEventListener('touchmove', handleTouchMove);
				container.removeEventListener('touchend', handleTouchEnd);
				
				// Clean up performance optimizations
				container.style.willChange = '';
				container.style.transform = '';
			}
			if (wheelTimeout) {
				clearTimeout(wheelTimeout);
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
		<div class="feed-item" class:active={index === currentIndex} style="contain: strict;">
			<MediaItem {event} isActive={index === currentIndex} />
		</div>
	{/each}
</div>



<style>
	.feed-container {
		height: 100vh;
		width: 100vw;
		overflow-y: hidden;
		overflow-x: hidden;
		scroll-snap-type: y mandatory;
		scroll-behavior: auto;
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
	}


</style>