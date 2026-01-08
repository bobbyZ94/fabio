import { createDirectusClient } from '$lib/directus';
import { readItems } from '@directus/sdk';
import type { PageLoad } from './$types';

export const ssr = false;

export const load: PageLoad = async ({ fetch }) => {
	try {
		const directus = createDirectusClient(fetch);
		const places = await directus.request(
			readItems('place', {
				filter: {
					status: {
						_eq: 'published'
					}
				},
				fields: ['*'],
				sort: ['-date'] // Sort by date descending (newest first)
			})
		);

		return {
			places
		};
	} catch (error) {
		console.error('Error fetching places:', error);
		return {
			places: []
		};
	}
};
