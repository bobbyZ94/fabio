/**
 * Content processing utilities
 */

interface ImageOptimizationOptions {
	format?: string;
	width?: string;
	quality?: string;
}

const DEFAULT_IMAGE_OPTIONS: ImageOptimizationOptions = {
	format: 'webp',
	width: '800',
	quality: '100'
};

/**
 * Optimizes an image URL by adding or modifying query parameters.
 * Removes conflicting Directus parameters and applies optimization settings.
 * 
 * @param url - The image URL to optimize
 * @param options - Optimization parameters (format, width, quality)
 * @returns Optimized URL or original URL if parsing fails
 */
export function optimizeImageUrl(
	url: string,
	options: ImageOptimizationOptions = DEFAULT_IMAGE_OPTIONS
): string {
	try {
		// Handle encoded ampersands in HTML
		const cleanUrl = url.replace(/&amp;/g, '&');
		
		// Parse URL (handle relative paths by providing a dummy base)
		const isAbsolute = cleanUrl.startsWith('http') || cleanUrl.startsWith('//');
		const base = 'http://dummy-base.com';
		const urlObj = new URL(cleanUrl, base);

		// Remove conflicting Directus parameters
		const paramsToRemove = ['key', 'width', 'height'];
		paramsToRemove.forEach(param => urlObj.searchParams.delete(param));

		// Set optimization parameters
		if (options.format) urlObj.searchParams.set('format', options.format);
		if (options.width) urlObj.searchParams.set('width', options.width);
		if (options.quality) urlObj.searchParams.set('quality', options.quality);

		// Reconstruct the URL
		return isAbsolute 
			? urlObj.href 
			: urlObj.pathname + urlObj.search;
	} catch (error) {
		console.error('Error optimizing image URL:', error, 'URL:', url);
		return url; // Return original URL on error
	}
}

/**
 * Processes HTML content to optimize image URLs.
 * Finds all src attributes pointing to /assets/ and optimizes them.
 * 
 * @param html - The HTML string to process
 * @param options - Image optimization options
 * @returns Processed HTML with optimized image URLs
 */
export function optimizeContent(
	html: string,
	options: ImageOptimizationOptions = DEFAULT_IMAGE_OPTIONS
): string {
	if (!html) return '';
	
	return html.replace(/src="([^"]+)"/g, (match, url) => {
		// Only optimize assets from the /assets/ directory
		if (!url.includes('/assets/')) {
			return match;
		}
		
		const optimizedUrl = optimizeImageUrl(url, options);
		return `src="${optimizedUrl}"`;
	});
}
