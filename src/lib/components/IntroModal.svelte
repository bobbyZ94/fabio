<script lang="ts">
	import { optimizeContent } from '$lib/contentUtils';

	interface Props {
		introduction?: { text?: string } | { text?: string }[] | null;
		open?: boolean;
		onclose: () => void;
	}

	let { introduction, open = false, onclose }: Props = $props();
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-backdrop" onclick={onclose}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="story-header">
				<h2>Wer bin ich?</h2>
				<button class="close-btn" onclick={onclose}>&times;</button>
			</div>
			
			<div class="story-body">
				{#if introduction && !Array.isArray(introduction) && introduction.text}
					{@html optimizeContent(introduction.text)}
				{:else}
					<p>Keine Einführung verfügbar.</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
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
		background: none;
		border: none;
		font-size: 2rem;
		cursor: pointer;
		color: #333;
		line-height: 1;
		padding: 0;
		margin: 0;
	}

	.story-header {
		margin-bottom: 1rem;
		border-bottom: 1px solid #000000;
		padding-bottom: 0.5rem;
		font-family: 'Roboto', system-ui, sans-serif;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.story-header h2 {
		margin: 0;
		font-size: 1.8rem;
	}

	.story-body {
		line-height: 1.6;
		font-family: 'Roboto', system-ui, sans-serif;
	}

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
