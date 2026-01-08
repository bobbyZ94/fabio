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

let apiUrl = PUBLIC_DIRECTUS_URL;
if (typeof window !== 'undefined' && apiUrl.startsWith('/')) {
	apiUrl = new URL(apiUrl, window.location.origin).href;
}

export const directus = createDirectus<Schema>(apiUrl).with(rest());

export const getImageUrl = (fileId: string, transformKey?: string) => {
	let url = `${PUBLIC_DIRECTUS_URL}/assets/${fileId}`;
	if (transformKey) {
		url += `?key=${transformKey}`;
	}
	return url;
};
