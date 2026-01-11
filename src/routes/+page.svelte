<script lang="ts">
	import { getImageUrl } from '$lib/directus';
	import { generateSlug } from '$lib/contentUtils';
	import IntroModal from '$lib/components/IntroModal.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let showIntroModal: boolean = $state(false);
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
			<a href="/place/{generateSlug(place.name)}" class="place-card">
				<div class="place-image">
					<img src={getImageUrl(place.thumbnail, 'list-thumb')} alt={place.name} />
				</div>
				<div class="place-info">
					<h2>{place.name}</h2>
					<span class="date">{new Date(place.date).toLocaleDateString()}</span>
				</div>
			</a>
		{/each}
	</div>
</div>

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
		width: 100%;
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
		text-decoration: none;
		color: inherit;
		transition: transform 0.2s, box-shadow 0.2s;
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

	@media (max-width: 768px) {
		h1 {
			font-size: 1.5rem;
		}
	}
	@media (max-width: 410px) {
		h1 {
			font-size: 1.25rem;
		}
		.places-grid {
			grid-template-columns: repeat(auto-fill, minmax(150px, 150px));
		}
	}
</style>