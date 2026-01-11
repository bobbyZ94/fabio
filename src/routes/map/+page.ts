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
				fields: ['*'] // Fetch all fields including thumbnail, story, etc.
			})
		);

		const introduction = await directus.request(
			readItems('introduction' as any, {
				fields: ['text'],
				limit: 1
			})
		);

		return {
			places,
			introduction: Array.isArray(introduction) && introduction.length > 0 ? introduction[0] : introduction
		};
	} catch (error) {
		console.error('Error fetching data:', error);
		return {
			places: [],
			introduction: null
		};
	}
};

