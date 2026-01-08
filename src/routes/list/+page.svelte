<script lang="ts">
	import { getImageUrl } from '$lib/directus';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let selectedPlace: any = $state(null);

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
	<title>Baukulturerbe - Listen Ansicht</title>
</svelte:head>

<div class="container">
	<header>
		<h1>Baukulturerbe</h1>
		<a href="/" class="back-btn">← Zur Karte</a>
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

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'Titillium Web', sans-serif;
		background: #f5f5f5;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid #333;
	}

	h1 {
		margin: 0;
		font-size: 2rem;
		color: #333;
	}

	.back-btn {
		padding: 0.75rem 1.5rem;
		background: #333;
		color: white;
		text-decoration: none;
		border-radius: 4px;
		font-weight: 600;
		transition: background 0.2s;
	}

	.back-btn:hover {
		background: #555;
	}

	.places-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1.5rem;
	}

	.place-card {
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		overflow: hidden;
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s;
		text-align: left;
		padding: 0;
		width: 100%;
	}

	.place-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
	}

	.place-image {
		width: 100%;
		height: 200px;
		overflow: hidden;
	}

	.place-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.place-info {
		padding: 1rem;
	}

	.place-info h2 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
		color: #333;
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
		padding: 2rem;
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
		font-family: 'Titillium Web', sans-serif;
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
		font-family: 'Titillium Web', sans-serif;
	}

	.story-body :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: 4px;
	}
</style>
