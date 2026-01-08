<script lang="ts">
	import { onMount } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { getImageUrl } from '$lib/directus';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const MAP_MAX_ZOOM = 18;
	const CLUSTER_MAX_ZOOM = 17;
	const THUMBNAIL_ZOOM = 16;
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
			center: [10.5, 51.0], // Germany
			zoom: 4,
			maxZoom: MAP_MAX_ZOOM,
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

			// Simple GeoJSON source without clustering - we'll handle it client-side
			if (!map.getSource('places')) {
				map.addSource('places', {
					type: 'geojson',
					data: ({ type: 'FeatureCollection', features } as any)
				});
			}

			// Render card markers with custom clustering
			updateMarkers();
			map.on('moveend', updateMarkers);
			map.on('zoomend', updateMarkers);
		});

		// Log map errors to help diagnose tile/style issues
		map.on('error', (e: any) => {
			console.error('MapLibre error:', e?.error || e);
		});

		// Log current zoom level
		map.on('zoom', () => {
			console.log('Current zoom level:', map.getZoom().toFixed(2));
		});

		return () => {
			map.remove();
		};
	});

	function zoomToThumbnail(coords: [number, number], onComplete?: () => void) {
		if (!map) return;
		const zoomTarget = Math.min(map.getMaxZoom(), THUMBNAIL_ZOOM);
		console.log('Zooming to thumbnail:', { coords, currentZoom: map.getZoom(), targetZoom: zoomTarget });
		map.flyTo({ center: coords, zoom: zoomTarget, duration: 2500, essential: true });
		if (onComplete) {
			map.once('moveend', onComplete);
		}
	}

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

		new maplibregl.Marker({ element: el, anchor: 'center' })
			.setLngLat(place.point.coordinates)
			.addTo(map);
	}

	function updateMarkers() {
		// Remove existing card markers
		markers.forEach((m) => m.remove());
		markers = [];

		// Get places within extended viewport for accurate clustering
		const bounds = map.getBounds();
		const sw = bounds.getSouthWest();
		const ne = bounds.getNorthEast();
		
		// Extend bounds significantly for edge cases
		const lngPadding = (ne.lng - sw.lng) * 1;
		const latPadding = (ne.lat - sw.lat) * 1;
		
		const nearbyPlaces = Object.values(placeById).filter((place: any) => {
			if (!place?.point?.coordinates) return false;
			const [lng, lat] = place.point.coordinates;
			return lng >= sw.lng - lngPadding && lng <= ne.lng + lngPadding &&
			       lat >= sw.lat - latPadding && lat <= ne.lat + latPadding;
		});

		if (nearbyPlaces.length === 0) return;

		// Calculate pixel positions only for nearby places (for accurate clustering)
		const places = nearbyPlaces.map((place: any) => {
			const coords = place.point.coordinates as [number, number];
			const pixel = map.project(coords);
			return { place, coords, pixel };
		});

		// Group overlapping thumbnails
		const OVERLAP_THRESHOLD = 100; // pixels - thumbnail width + margin
		const groups: Array<Array<typeof places[0]>> = [];
		const grouped = new Set<number>();

		for (let i = 0; i < places.length; i++) {
			if (grouped.has(i)) continue;

			const group = [places[i]];
			grouped.add(i);

			for (let j = i + 1; j < places.length; j++) {
				if (grouped.has(j)) continue;

				const dx = places[i].pixel.x - places[j].pixel.x;
				const dy = places[i].pixel.y - places[j].pixel.y;
				const distance = Math.sqrt(dx * dx + dy * dy);

				if (distance < OVERLAP_THRESHOLD) {
					group.push(places[j]);
					grouped.add(j);
				}
			}

			groups.push(group);
		}

		// Render markers: single thumbnails or clustered count markers
		for (const group of groups) {
			if (group.length === 1) {
				// Single thumbnail
				const marker = createDOMMarker(group[0].place);
				marker.setLngLat(group[0].coords).addTo(map);
				markers.push(marker);
			} else {
				// Multiple overlapping thumbnails - show count marker at geographic centroid
				const avgLng = group.reduce((sum, item) => sum + item.coords[0], 0) / group.length;
				const avgLat = group.reduce((sum, item) => sum + item.coords[1], 0) / group.length;
				const centerCoords: [number, number] = [avgLng, avgLat];
				const marker = createCountMarker(group.length, group.map(g => g.place), centerCoords);
				marker.setLngLat(centerCoords).addTo(map);
				markers.push(marker);
			}
		}
	}

	function createCountMarker(count: number, places: any[], centerCoords: [number, number]) {
		const el = document.createElement('div');
		el.className = 'thumbnail-cluster';
		el.style.width = '40px';
		el.style.height = '40px';
		el.style.borderRadius = '50%';
		el.style.background = '#d00';
		el.style.border = '2px solid white';
		el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
		el.style.display = 'flex';
		el.style.alignItems = 'center';
		el.style.justifyContent = 'center';
		el.style.color = 'white';
		el.style.fontWeight = '600';
		el.style.fontSize = '12px';
		el.style.cursor = 'pointer';
		el.textContent = count.toString();

		el.addEventListener('click', (e) => {
			e.stopPropagation();
			// Zoom in enough to separate the thumbnails (reduce cluster count by at least 1)
			const currentZoom = map.getZoom();
			// Increase zoom by 2.5 to ensure cluster splits
			map.flyTo({ center: centerCoords, zoom: currentZoom + 2.5, duration: 1000, essential: true });
		});

		return new maplibregl.Marker({ element: el, anchor: 'center' });
	}

	function createDOMMarker(place: any) {
		const el = document.createElement('div');
		el.className = 'marker-thumbnail';
		el.style.width = '100px';
		el.style.height = '100px';
		el.style.borderRadius = '50%';
		el.style.overflow = 'hidden';
		el.style.boxShadow = '0 3px 8px rgba(0,0,0,0.3)';
		el.style.border = '2px solid white';
		el.style.backgroundColor = '#ddd';
		el.style.cursor = 'pointer';

		const img = document.createElement('img');
		img.src = getImageUrl(place.thumbnail, 'map-thumb');
		img.alt = place.name;
		img.style.width = '100%';
		img.style.height = '100%';
		img.style.objectFit = 'cover';
		el.appendChild(img);

		el.addEventListener('click', (e) => {
			e.stopPropagation();
			const currentZoom = map.getZoom();
			const coords = place?.point?.coordinates as [number, number] | undefined;
			
			if (coords && currentZoom < THUMBNAIL_ZOOM - 0.5) {
				// If not zoomed in enough, zoom first then open modal
				zoomToThumbnail(coords, () => {
					selectedPlace = place;
				});
			} else {
				// Already zoomed in, open the modal immediately
				selectedPlace = place;
			}
		});

		return new maplibregl.Marker({ element: el, anchor: 'center' });
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

<a href="/list" class="list-btn">Listen Ansicht</a>

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

	.list-btn {
		position: fixed;
		top: 1rem;
		left: 1rem;
		z-index: 10;
		padding: 0.75rem 1.25rem;
		background: white;
		color: #333;
		text-decoration: none;
		border-radius: 4px;
		font-weight: 600;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
		transition: background 0.2s, transform 0.2s;
		font-size: 0.95rem;
	}

	.list-btn:hover {
		background: #f5f5f5;
		transform: translateY(-2px);
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