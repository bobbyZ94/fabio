import { createDirectusClient } from '$lib/directus';
import { readItems } from '@directus/sdk';
import { generateSlug } from '$lib/contentUtils';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
	try {
		const directus = createDirectusClient(fetch);
		
		// Fetch all places to find the one matching the slug
		const places = await directus.request(
			readItems('place', {
				filter: {
					status: {
						_eq: 'published'
					}
				},
				fields: ['*']
			})
		);

		// Find the place by matching the slug
		const place = places.find(p => generateSlug(p.name) === params.slug);

		if (!place) {
			throw error(404, 'Place not found');
		}

		return {
			place
		};
	} catch (err) {
		console.error('Error fetching place:', err);
		throw error(404, 'Place not found');
	}
};
