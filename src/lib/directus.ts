import { createDirectus, rest } from '@directus/sdk';
import { PUBLIC_DIRECTUS_URL } from '$env/static/public';

interface Place {
	id: number;
	status: string;
	name: string;
	date: string;
	point: {
		type: 'Point';
		coordinates: [number, number];
	};
	thumbnail: string; // UUID of the file
	story: string;
}

interface Schema {
	place: Place[];
}

export const createDirectusClient = (fetchFn?: typeof fetch) => {
	let apiUrl = PUBLIC_DIRECTUS_URL;
	if (typeof window !== 'undefined' && apiUrl.startsWith('/')) {
		apiUrl = new URL(apiUrl, window.location.origin).href;
	}
	
	const client = createDirectus<Schema>(apiUrl).with(
		rest({
			onRequest: (options) => {
				if (fetchFn) {
					return { ...options, fetch: fetchFn };
				}
				return options;
			}
		})
	);
	
	return client;
};

export const directus = createDirectusClient();

export const getImageUrl = (fileId: string, transformKey?: string) => {
	let url = `${PUBLIC_DIRECTUS_URL}/assets/${fileId}`;
	if (transformKey) {
		url += `?key=${transformKey}`;
	}
	return url;
};
