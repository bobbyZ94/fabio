<script lang="ts">
	import { onMount } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { getImageUrl } from '$lib/directus';
	import { optimizeContent } from '$lib/contentUtils';
	import type { PageData } from './$types';

	// Type definitions
	interface Point {
		type: 'Point';
		coordinates: [number, number];
	}

	interface Place {
		id: number;
		status: string;
		name: string;
		date: string;
		thumbnail: string;
		story: string;
		point: Point;
	}

	interface PixelPosition {
		x: number;
		y: number;
	}

	interface PlaceWithPosition {
		place: Place;
		coords: [number, number];
		pixel: PixelPosition;
	}

	let { data }: { data: PageData } = $props();

	// Centralized map configuration
	const MAP_CONFIG = {
		center: [10.5, 51.0] as [number, number], // Germany
		zoom: 4,
		maxZoom: 18,
		minZoom: 2,
		thumbnailZoom: 16,
		style: 'https://demotiles.maplibre.org/style.json',
		osmTiles: [
			'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
			'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
			'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
		],
		osmAttribution: '© OpenStreetMap contributors',
		clustering: {
			overlapThreshold: 100, // pixels
			viewportPadding: 1.0, // multiplier for extended bounds
			zoomIncrement: 2.5 // zoom increase when clicking cluster
		}
	};

	// Marker style constants
	const MARKER_STYLES = {
		cluster: {
			width: '40px',
			height: '40px',
			borderRadius: '50%',
			background: '#d00',
			border: '2px solid white',
			boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			color: 'white',
			fontWeight: '600',
			fontSize: '12px',
			cursor: 'pointer'
		},
		thumbnail: {
			width: '100px',
			height: '100px',
			borderRadius: '50%',
			overflow: 'hidden',
			boxShadow: '0 3px 8px rgba(0,0,0,0.3)',
			border: '2px solid white',
			backgroundColor: '#ddd',
			cursor: 'pointer'
		},
		thumbnailImage: {
			width: '100%',
			height: '100%',
			objectFit: 'cover'
		},
		thumbnailTitle: {
			background: '#ffffff',
			color: '#000000',
			fontSize: '11px',
			fontWeight: '600',
			padding: '4px 6px',
			boxSizing: 'border-box',
			textAlign: 'center',
			maxWidth: '120px',
			borderRadius: '6px',
			transform: 'translateY(-25px)',
			margin: '10px'
		},
		wrapper: {
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center'
		}
	};

	let mapContainer: HTMLDivElement;
	let map: maplibregl.Map;
	let selectedPlace: Place | null = $state(null);
	let showIntroModal: boolean = $state(false);
	let markers: maplibregl.Marker[] = [];
	let placeById: Record<number, Place> = {};

	onMount(() => {
		map = new maplibregl.Map({
			container: mapContainer,
			style: MAP_CONFIG.style,
			center: MAP_CONFIG.center,
			zoom: MAP_CONFIG.zoom,
			maxZoom: MAP_CONFIG.maxZoom,
			minZoom: MAP_CONFIG.minZoom,
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
					tiles: MAP_CONFIG.osmTiles,
					tileSize: 256,
					attribution: MAP_CONFIG.osmAttribution,
					minzoom: 0,
					maxzoom: 19
				});
				map.addLayer({ id: 'osmde-layer', type: 'raster', source: 'osmde' });
			}

			// Index places by id for quick lookup
			if (data.places) {
				data.places.forEach((p) => {
					if (p?.id) placeById[p.id] = p;
				});
			}

			// Build clustered source of places
			const features = (data.places || [])
				.filter((p): p is Place => p?.point?.coordinates !== undefined)
				.map((p) => ({
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
		map.on('error', (e: maplibregl.ErrorEvent) => {
			console.error('MapLibre error:', e.error);
		});

		return () => {
			map.remove();
		};
	});

	function zoomToThumbnail(coords: [number, number], onComplete?: () => void) {
		if (!map) return;
		const zoomTarget = Math.min(map.getMaxZoom(), MAP_CONFIG.thumbnailZoom);
		map.flyTo({ center: coords, zoom: zoomTarget, duration: 2000, essential: true });
		if (onComplete) {
			map.once('moveend', onComplete);
		}
	}

	function getVisiblePlaces(): PlaceWithPosition[] {
		const bounds = map.getBounds();
		const sw = bounds.getSouthWest();
		const ne = bounds.getNorthEast();
		
		// Extend bounds for edge cases
		const lngPadding = (ne.lng - sw.lng) * MAP_CONFIG.clustering.viewportPadding;
		const latPadding = (ne.lat - sw.lat) * MAP_CONFIG.clustering.viewportPadding;
		
		const nearbyPlaces = Object.values(placeById).filter((place): place is Place => {
			if (!place?.point?.coordinates) return false;
			const [lng, lat] = place.point.coordinates;
			return lng >= sw.lng - lngPadding && lng <= ne.lng + lngPadding &&
			       lat >= sw.lat - latPadding && lat <= ne.lat + latPadding;
		});

		// Calculate pixel positions for clustering
		return nearbyPlaces.map((place) => {
			const coords = place.point.coordinates;
			const pixel = map.project(coords);
			return { place, coords, pixel };
		});
	}

	/**
	 * Pure function: Groups items by proximity in 2D pixel space.
	 * Uses a simple greedy clustering algorithm.
	 * @param items Array of items with pixel coordinates
	 * @param threshold Distance threshold for grouping
	 * @returns Array of groups, where each group contains clustered items
	 */
	function clusterByProximity<T extends { pixel: { x: number; y: number } }>(
		items: T[],
		threshold: number
	): T[][] {
		const groups: T[][] = [];
		const grouped = new Set<number>();

		for (let i = 0; i < items.length; i++) {
			if (grouped.has(i)) continue;

			const group = [items[i]];
			grouped.add(i);

			for (let j = i + 1; j < items.length; j++) {
				if (grouped.has(j)) continue;

				const dx = items[i].pixel.x - items[j].pixel.x;
				const dy = items[i].pixel.y - items[j].pixel.y;
				const distance = Math.sqrt(dx * dx + dy * dy);

				if (distance < threshold) {
					group.push(items[j]);
					grouped.add(j);
				}
			}

			groups.push(group);
		}

		return groups;
	}

	function clusterPlaces(places: PlaceWithPosition[]): PlaceWithPosition[][] {
		return clusterByProximity(places, MAP_CONFIG.clustering.overlapThreshold);
	}

	function renderMarkers(groups: PlaceWithPosition[][]) {
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

	function updateMarkers() {
		// Remove existing markers
		markers.forEach((m) => m.remove());
		markers = [];

		// Get places within viewport
		const places = getVisiblePlaces();
		if (places.length === 0) return;

		// Group overlapping places
		const groups = clusterPlaces(places);

		// Render markers for each group
		renderMarkers(groups);
	}

	/**
	 * Helper function to create DOM elements with styles and attributes.
	 * Reduces repetitive DOM manipulation code.
	 */
	function createElement<K extends keyof HTMLElementTagNameMap>(
		tag: K,
		options: {
			className?: string;
			styles?: Partial<CSSStyleDeclaration>;
			attributes?: Record<string, string>;
			textContent?: string;
		} = {}
	): HTMLElementTagNameMap[K] {
		const element = document.createElement(tag);
		
		if (options.className) {
			element.className = options.className;
		}
		
		if (options.styles) {
			Object.assign(element.style, options.styles);
		}
		
		if (options.attributes) {
			Object.entries(options.attributes).forEach(([key, value]) => {
				element.setAttribute(key, value);
			});
		}
		
		if (options.textContent) {
			element.textContent = options.textContent;
		}
		
		return element;
	}

	function createCountMarker(count: number, places: Place[], centerCoords: [number, number]) {
		const el = createElement('div', {
			className: 'thumbnail-cluster',
			styles: MARKER_STYLES.cluster,
			textContent: count.toString()
		});

		el.addEventListener('click', (e) => {
			e.stopPropagation();
			// Zoom in enough to separate the thumbnails (reduce cluster count by at least 1)
			const currentZoom = map.getZoom();
			map.flyTo({ center: centerCoords, zoom: currentZoom + MAP_CONFIG.clustering.zoomIncrement, duration: 2000, essential: true });
		});

		return new maplibregl.Marker({ element: el, anchor: 'center' });
	}

	function createDOMMarker(place: Place) {
		// Wrapper container for marker + title
		const wrapper = createElement('div', {
			className: 'marker-wrapper',
			styles: MARKER_STYLES.wrapper
		});

		// Circular thumbnail
		const el = createElement('div', {
			className: 'marker-thumbnail',
			styles: MARKER_STYLES.thumbnail
		});

		const img = createElement('img', {
			styles: MARKER_STYLES.thumbnailImage,
			attributes: {
				src: getImageUrl(place.thumbnail, 'map-thumb'),
				alt: place.name
			}
		});
		el.appendChild(img);

		// Title overlapping bottom quarter
		const title = createElement('div', {
			className: 'marker-thumb-title',
			styles: MARKER_STYLES.thumbnailTitle,
			textContent: place.name
		});

		wrapper.appendChild(el);
		wrapper.appendChild(title);

		wrapper.addEventListener('click', (e) => {
			e.stopPropagation();
			const currentZoom = map.getZoom();
			const coords = place.point.coordinates;
			
			if (coords && currentZoom < MAP_CONFIG.thumbnailZoom - 0.5) {
				// If not zoomed in enough, zoom first then open modal
				zoomToThumbnail(coords, () => {
					selectedPlace = place;
				});
			} else {
				// Already zoomed in, open the modal immediately
				selectedPlace = place;
			}
		});

		return new maplibregl.Marker({ element: wrapper, anchor: 'center' });
	}

	function closeStory() {
		selectedPlace = null;
	}

	function openIntroModal() {
		showIntroModal = true;
	}

	function closeIntroModal() {
		showIntroModal = false;
	}
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
</svelte:head>

<div class="top-buttons">
	<a href="/list" class="list-btn">Listen Ansicht</a>
	<button class="intro-btn" onclick={openIntroModal}>?</button>
</div>

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

{#if showIntroModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-backdrop" onclick={closeIntroModal}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<button class="close-btn" onclick={closeIntroModal}>&times;</button>
			
			<div class="story-header">
				<h2>Wer bin ich?</h2>
			</div>
			
			<div class="story-body">
				{#if data.introduction && !Array.isArray(data.introduction) && data.introduction.text}
					{@html optimizeContent(data.introduction.text)}
				{:else}
					<p>Keine Einführung verfügbar.</p>
				{/if}
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

	.top-buttons {
		position: fixed;
		top: 1rem;
		left: 1rem;
		z-index: 10;
		display: flex;
		gap: 0.5rem;
	}

	.list-btn, .intro-btn {
		padding: 0.75rem 1.25rem;
		background: white;
		color: #333;
		text-decoration: none;
		border: none;
		border-radius: 4px;
		font-weight: 600;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
		transition: background 0.2s, transform 0.2s;
		font-size: 0.95rem;
		cursor: pointer;
		font-family: 'Titillium Web', sans-serif;
	}

	.list-btn:hover, .intro-btn:hover {
		background: #f5f5f5;
		transform: translateY(-2px);
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
		margin-left: 10px;
		margin-right: 10px;
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

	@media (min-width: 1000px) {
		.modal-content {
			padding: 2rem;
		}
	}
</style>