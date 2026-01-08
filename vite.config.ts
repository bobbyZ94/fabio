import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		proxy: {
			'/directus': {
				target: 'https://cms.fabio.zioltkowski.de',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/directus/, '')
			}
		}
	}
});
