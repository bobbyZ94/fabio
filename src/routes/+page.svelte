<script lang="ts">
	import { getImageUrl } from '$lib/directus';
	import IntroModal from '$lib/components/IntroModal.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let selectedPlace: any = $state(null);
	let showIntroModal: boolean = $state(false);

	function optimizeContent(html: string) {
		if (!html) return '';
		return html.replace(/src="([^"]+)"/g, (match, url) => {
			if (url.includes('/assets/')) {
				try {
					const cleanUrl = url.replace(/&amp;/g, '&');
					const isAbsolute = cleanUrl.startsWith('http') || cleanUrl.startsWith('//');
					const base = 'http://dummy-base.com';
					const urlObj = new URL(cleanUrl, base);

					urlObj.searchParams.delete('key');
					urlObj.searchParams.delete('width');
					urlObj.searchParams.delete('height');

					urlObj.searchParams.set('format', 'webp');
					urlObj.searchParams.set('width', '800');
					urlObj.searchParams.set('quality', '100');

					const finalUrl = isAbsolute 
						? urlObj.href 
						: urlObj.pathname + urlObj.search;
					
					return `src="${finalUrl}"`;
				} catch (e) {
					console.error('Error parsing image URL:', e);
					return match;
				}
			}
			return match;
		});
	}

	function closeStory() {
		selectedPlace = null;
	}
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
	<title>Baukulturerbe</title>
</svelte:head>

<div class="container">
	<header>
		<div class="button-group">
			<a href="/map" class="map-view-btn">Kartenansicht</a>
			<button class="intro-btn" onclick={() => showIntroModal = true}>?</button>
		</div>
		<h1>Baukulturerbe</h1>
	</header>
	<div class="places-grid">
		{#each data.places || [] as place (place.id)}
			<button class="place-card" onclick={() => selectedPlace = place}>
				<div class="place-image">
					<img src={getImageUrl(place.thumbnail, 'list-thumb')} alt={place.name} />
				</div>
				<div class="place-info">
					<h2>{place.name}</h2>
					<span class="date">{new Date(place.date).toLocaleDateString()}</span>
				</div>
			</button>
		{/each}
	</div>
</div>

{#if selectedPlace}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-backdrop" onclick={closeStory}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<button class="close-btn" onclick={closeStory}>&times;</button>
			<div class="story-header">
				<h2>{selectedPlace.name}</h2>
				<span class="date">{new Date(selectedPlace.date).toLocaleDateString()}</span>
			</div>
			<div class="story-body">
				{@html optimizeContent(selectedPlace.story)}
			</div>
		</div>
	</div>
{/if}

<IntroModal introduction={data.introduction} open={showIntroModal} onclose={() => showIntroModal = false} />

<style>
	:global(html),
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'Roboto', system-ui, sans-serif;
		background: #f5f5f5;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem;
		min-height: 100vh;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid #333;
	}

	.button-group {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	h1 {
		margin: 0;
		font-size: 2rem;
		color: #333;
	}

	.map-view-btn, .intro-btn {
		padding: 0.75rem 1.25rem;
		background: #333;
		color: white;
		text-decoration: none;
		border: none;
		border-radius: 4px;
		font-weight: 600;
		transition: background 0.2s, transform 0.2s;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
		font-size: 1rem;
		cursor: pointer;
	}

	.intro-btn:hover, .map-view-btn:hover {
		background: #555;
		transform: translateY(-2px);
	}

	.places-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 180px));
        gap: 1rem;
        justify-content: center;
		width: 100%
    }

	.place-card {
        background: white;
        border: 1px solid #ddd;
        overflow: hidden;
        border-radius: 8px;
        cursor: pointer;
        text-align: left;
        padding: 0;
        display: grid;
        grid-template-rows: 200px auto;
    }

	.place-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
	}

	.place-image {
		width: 100%;
		height: 200px;
	}

	.place-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.place-info {
		padding: 10px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
	}

	.place-info h2 {
		margin: 0 0 0.5rem 0;
		font-size: 1rem;
		color: #333;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-overflow: ellipsis;
		font-family: 'Roboto', system-ui, sans-serif;
	}

	.date {
		color: #666;
		font-size: 0.9rem;
	}

	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	.modal-content {
		background: #f0eded;
		padding: 1rem;
		border-radius: 8px;
		width: 90%;
		max-width: 800px;
		max-height: 80vh;
		overflow-y: auto;
		position: relative;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}

	.close-btn {
		position: absolute;
		top: 10px;
		right: 15px;
		background: none;
		border: none;
		font-size: 2rem;
		cursor: pointer;
		color: #333;
	}

	.story-header {
		margin-bottom: 1rem;
		border-bottom: 1px solid #000000;
		padding-bottom: 0.5rem;
		font-family: 'Roboto', system-ui, sans-serif;
	}

	.story-header h2 {
		margin-bottom: 10px;
		font-size: 1.8rem;
	}

	.story-header .date {
		color: #666;
		font-size: 1rem;
	}

	.story-body {
		line-height: 1.6;
		font-family: 'Roboto', system-ui, sans-serif;
	}

	.story-body :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: 4px;
	}

	@media (min-width: 1000px) {
		.modal-content {
			padding: 2rem;
		}
	}

</style>


