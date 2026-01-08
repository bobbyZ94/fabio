<script lang="ts">
	import { onMount } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { getImageUrl } from '$lib/directus';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let mapContainer: HTMLDivElement;
	let map: maplibregl.Map;
	let selectedPlace: any = $state(null);
	let markers: maplibregl.Marker[] = [];
	let placeById: Record<string, any> = {};

	onMount(() => {
		map = new maplibregl.Map({
			container: mapContainer,
			// Robust vector base style
			style: 'https://demotiles.maplibre.org/style.json',
			center: [0, 20],
			zoom: 1.5,
			maxZoom: 18,
			minZoom: 2,
			// Disable default attribution to avoid duplicates; we'll use a single compact control
			attributionControl: false
		});

		// Basic map controls
		map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }));
		map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }));
		map.addControl(new maplibregl.AttributionControl({ compact: true }));

		map.on('load', () => {
			// Add OSM raster base under vector layers for streets/cities
			if (!map.getSource('osmde')) {
				map.addSource('osmde', {
					type: 'raster',
					tiles: [
						'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
						'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
						'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
					],
					tileSize: 256,
					attribution: '© OpenStreetMap contributors',
					minzoom: 0,
					maxzoom: 19
				});
				map.addLayer({ id: 'osmde-layer', type: 'raster', source: 'osmde' });
			}

			// Index places by id for quick lookup
			if (data.places) {
				data.places.forEach((p: any) => {
					if (p?.id) placeById[p.id] = p;
				});
			}

			// Build clustered source of places
			const features = (data.places || [])
				.filter((p: any) => p?.point?.coordinates)
				.map((p: any) => ({
					type: 'Feature' as const,
					geometry: {
						type: 'Point' as const,
						coordinates: p.point.coordinates
					},
					properties: { id: p.id }
				}));

			if (!map.getSource('places')) {
				map.addSource('places', {
					type: 'geojson',
					data: ({ type: 'FeatureCollection', features } as any),
					cluster: true,
					clusterRadius: 60,
					clusterMaxZoom: 17
				});

				// Cluster circles
				map.addLayer({
					id: 'clusters',
					type: 'circle',
					source: 'places',
					filter: ['has', 'point_count'],
					paint: {
						'circle-color': '#d00',
						'circle-stroke-color': '#fff',
						'circle-stroke-width': 2,
						'circle-radius': [
							'step',
							['get', 'point_count'],
							16,
							10, 18,
							25, 22
						]
					}
				});

				// Cluster count labels
				map.addLayer({
					id: 'cluster-count',
					type: 'symbol',
					source: 'places',
					filter: ['has', 'point_count'],
					layout: {
						'text-field': ['get', 'point_count'],
						'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
						'text-size': 12
					},
					paint: { 'text-color': '#fff' }
				});

				// Invisible layer for unclustered points (for querying rendered features)
				map.addLayer({
					id: 'unclustered',
					type: 'circle',
					source: 'places',
					filter: ['!', ['has', 'point_count']],
					paint: { 'circle-opacity': 0 }
				});

				// Zoom into clusters on click
				map.on('click', 'clusters', (e: any) => {
					const feats = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
					const clusterId = feats?.[0]?.properties?.cluster_id;
					if (clusterId != null) {
						const source: any = map.getSource('places');
						source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
							if (err) return;
							map.easeTo({ center: (feats[0] as any).geometry.coordinates, zoom });
						});
					}
				});

				map.on('mouseenter', 'clusters', () => {
					map.getCanvas().style.cursor = 'pointer';
				});
				map.on('mouseleave', 'clusters', () => {
					map.getCanvas().style.cursor = '';
				});
			}

			// Render card markers only for unclustered points
			updateMarkers();
			map.on('moveend', updateMarkers);
			map.on('zoomend', updateMarkers);
		});

		// Log map errors to help diagnose tile/style issues
		map.on('error', (e: any) => {
			console.error('MapLibre error:', e?.error || e);
		});

		return () => {
			map.remove();
		};
	});

	function createMarker(place: any) {
		const el = document.createElement('div');
		el.className = 'marker-card';
		el.style.width = '170px';
		el.style.height = '110px';
		el.style.position = 'relative';
		el.style.borderRadius = '8px';
		el.style.overflow = 'hidden';
		el.style.boxShadow = '0 4px 10px rgba(0,0,0,0.25)';
		el.style.border = '1px solid rgba(0,0,0,0.15)';
		el.style.cursor = 'pointer';

		// Thumbnail image fills the card
		const img = document.createElement('img');
		img.src = getImageUrl(place.thumbnail, 'map-thumb');
		img.alt = place.name;
		img.style.width = '100%';
		img.style.height = '100%';
		img.style.objectFit = 'cover';
		el.appendChild(img);

		// Title overlay at the bottom of the card
		const title = document.createElement('div');
		title.className = 'marker-title';
		title.textContent = place.name;
		title.style.position = 'absolute';
		title.style.left = '0';
		title.style.right = '0';
		title.style.bottom = '0';
		title.style.padding = '6px 8px';
		title.style.background = 'linear-gradient( to top, rgba(0,0,0,0.55), rgba(0,0,0,0.15) )';
		title.style.color = '#fff';
		title.style.fontSize = '13px';
		title.style.fontWeight = '600';
		title.style.textShadow = '0 1px 2px rgba(0,0,0,0.6)';
		el.appendChild(title);

		// Add click event
		el.addEventListener('click', (e) => {
			e.stopPropagation();
			selectedPlace = place;
		});

		new maplibregl.Marker({ element: el, anchor: 'bottom' })
			.setLngLat(place.point.coordinates)
			.addTo(map);
	}

	function updateMarkers() {
		// Remove existing card markers
		markers.forEach((m) => m.remove());
		markers = [];

		if (!map.getLayer('unclustered')) return;
		// Query only rendered unclustered features to avoid duplicates
		const rendered = map.queryRenderedFeatures(undefined, { layers: ['unclustered'] });
		const seen = new Set<string>();
		for (const f of rendered as any[]) {
			const id = f?.properties?.id as string;
			if (!id || seen.has(id)) continue;
			seen.add(id);
			const place = placeById[id];
			if (!place) continue;
			const marker = createDOMMarker(place);
			marker.setLngLat(f.geometry.coordinates).addTo(map);
			markers.push(marker);
		}
	}

	function createDOMMarker(place: any) {
		const el = document.createElement('div');
		el.className = 'marker-card';
		el.style.width = '170px';
		el.style.height = '110px';
		el.style.position = 'relative';
		el.style.borderRadius = '8px';
		el.style.overflow = 'hidden';
		el.style.boxShadow = '0 4px 10px rgba(0,0,0,0.25)';
		el.style.border = '1px solid rgba(0,0,0,0.15)';
		el.style.cursor = 'pointer';

		const img = document.createElement('img');
		img.src = getImageUrl(place.thumbnail, 'map-thumb');
		img.alt = place.name;
		img.style.width = '100%';
		img.style.height = '100%';
		img.style.objectFit = 'cover';
		el.appendChild(img);

		const title = document.createElement('div');
		title.className = 'marker-title';
		title.textContent = place.name;
		title.style.position = 'absolute';
		title.style.left = '0';
		title.style.right = '0';
		title.style.bottom = '0';
		title.style.padding = '6px 8px';
		title.style.background = 'linear-gradient( to top, rgba(0,0,0,0.55), rgba(0,0,0,0.15) )';
		title.style.color = '#fff';
		title.style.fontSize = '13px';
		title.style.fontWeight = '600';
		title.style.textShadow = '0 1px 2px rgba(0,0,0,0.6)';
		el.appendChild(title);

		el.addEventListener('click', (e) => {
			e.stopPropagation();
			selectedPlace = place;
		});

		return new maplibregl.Marker({ element: el, anchor: 'bottom' });
	}

	function closeStory() {
		selectedPlace = null;
	}

	function optimizeContent(html: string) {
		if (!html) return '';
		return html.replace(/src="([^"]+)"/g, (match, url) => {
			if (url.includes('/assets/')) {
				try {
					// Handle encoded ampersands in HTML
					const cleanUrl = url.replace(/&amp;/g, '&');
					
					// Parse URL (handle relative paths by providing a dummy base)
					const isAbsolute = cleanUrl.startsWith('http') || cleanUrl.startsWith('//');
					const base = 'http://dummy-base.com';
					const urlObj = new URL(cleanUrl, base);

					// Remove conflicting Directus parameters
					urlObj.searchParams.delete('key');   // Presets conflict with custom transforms
					urlObj.searchParams.delete('width'); // Remove existing width to avoid duplicates
					urlObj.searchParams.delete('height');

					// Set optimization parameters
					urlObj.searchParams.set('format', 'webp');
					urlObj.searchParams.set('width', '800');
					urlObj.searchParams.set('quality', '100');

					// Reconstruct the URL
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
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
</svelte:head>

<div class="map-container" bind:this={mapContainer}></div>

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
		overflow: hidden;
		font-family: 'Titillium Web', sans-serif;
	}

	.map-container {
		width: 100vw;
		height: 100vh;
	}

	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.6);
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

	.date {
		color: #666;
		font-size: 1rem;
	}

	.story-body {
		line-height: 1.6;
		font-family: 'Titillium Web', sans-serif;
	}

	/* Wysiwyg content styles */
	.story-body :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: 4px;
	}
</style>