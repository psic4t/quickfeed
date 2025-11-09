<script lang="ts">
	import { registerSW } from 'virtual:pwa-register';

	let { children } = $props();

	const updateSW = registerSW({
		onOfflineReady() {
			console.log('App ready to work offline');
		},
		onNeedRefresh() {
			console.log('New content available, please refresh');
		},
	});
</script>

{@render children?.()}
