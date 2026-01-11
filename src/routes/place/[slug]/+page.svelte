<script lang="ts">
    import { MoveLeft, MapPinned } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { optimizeContent } from '$lib/contentUtils';
	import { getImageUrl } from '$lib/directus';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function navigateToMap() {
		const coords = data.place.point.coordinates;
		goto(`/map?lat=${coords[1]}&lng=${coords[0]}&zoom=16`);
	}
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
	<title>{data.place.name} - Baukulturerbe</title>
</svelte:head>

<div class="page-container">
	<div class="background-image" style="background-image: url('{getImageUrl(data.place.thumbnail, 'page-bg')}');"></div>
	<div class="button-bar">
		<button class="back-button" onclick={() => window.history.back()}><MoveLeft /></button>
		<button class="map-button" onclick={navigateToMap}><MapPinned /></button>
	</div>
	<article class="place-article">
		<header class="place-header">
			<h1>{data.place.name}</h1>
			<div class="meta">
				<time class="date">{new Date(data.place.date).toLocaleDateString('de-DE')}</time>
				<span class="rating">⭐{data.place.rating}/10</span>
			</div>
		</header>

		<div class="place-content">
			{@html optimizeContent(data.place.story)}
		</div>
	</article>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'Roboto', system-ui, sans-serif;
		background: #f5f5f5;
	}

	.page-container {
		max-width: 900px;
		margin: 0 auto;
		padding: 2rem 1rem;
		min-height: 100vh;
		position: relative;
	}

	.background-image {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		opacity: 0.2;
		filter: grayscale(100%);
	}

	.button-bar {
		display: flex;
		justify-content: space-between;
		margin-bottom: 2rem;
		position: relative;
		z-index: 1;
	}

	.back-button, .map-button {
		color: #333;
		text-decoration: none;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 1rem;
		background: white;
		border: none;
		border-radius: 4px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		transition: background 0.2s, transform 0.2s;
		cursor: pointer;
		font-size: 1.5rem;
		line-height: 1;
	}

	.back-button:hover {
		background: #f0f0f0;
		transform: translateX(-4px);
	}

	.map-button:hover {
		background: #f0f0f0;
		transform: scale(1.05);
	}

	.place-article {
		background: white;
		border-radius: 8px;
		padding: 2rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		position: relative;
		z-index: 1;
	}

	.place-header {
		margin-bottom: 2rem;
		border-bottom: 2px solid #000;
		padding-bottom: 1rem;
	}

	.place-header h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2.5rem;
		color: #333;
		font-weight: 700;
	}

	.meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.date {
		color: #666;
		font-size: 1rem;
		font-weight: 500;
	}

	.rating {
		color: #666;
		font-size: 1rem;
		font-weight: 500;
	}

	.place-content {
		line-height: 1.8;
		color: #333;
		font-size: 1.1rem;
	}

	.place-content :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: 4px;
		margin: 1.5rem 0;
	}

	.place-content :global(p) {
		margin-bottom: 1.5rem;
	}

	.place-content :global(h2),
	.place-content :global(h3) {
		margin-top: 2rem;
		margin-bottom: 1rem;
		color: #222;
	}

	.place-content :global(a) {
		color: #d00;
		text-decoration: none;
		border-bottom: 1px solid #d00;
	}

	.place-content :global(a:hover) {
		color: #a00;
		border-bottom-color: #a00;
	}

	@media (max-width: 768px) {
		.page-container {
			padding: 1rem 0.5rem;
		}

		.place-article {
			padding: 1.5rem;
		}

		.place-header h1 {
			font-size: 1.8rem;
		}

		.place-content {
			font-size: 1rem;
		}
	}
</style>
