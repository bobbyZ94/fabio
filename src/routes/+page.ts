import { directus } from '$lib/directus';
import { readItems } from '@directus/sdk';
import type { PageLoad } from './$types';

export const ssr = false;

export const load: PageLoad = async () => {
	try {
		const places = await directus.request(
			readItems('place', {
				filter: {
					status: {
						_eq: 'published'
					}
				},
				fields: ['*'] // Fetch all fields including thumbnail, story, etc.
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
