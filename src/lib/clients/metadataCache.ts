import { createStore, del, entries, get, set } from "idb-keyval";

/**
 * Chain-metadata cache keyed by runtime codeHash, persisted in IndexedDB.
 * Ported from Kheopswap — metadata is megabytes, so IndexedDB rather than
 * localStorage. Plugged into PAPI's createClient({ getMetadata, setMetadata }):
 * skips the expensive metadata fetch on every startup until the runtime
 * upgrades (new codeHash = cache miss).
 */

const metadataStore = createStore("taohop", "metadata-cache");

interface CachedMetadata {
	metadata: Uint8Array;
	timestamp: number;
}

/** One chain (bittensor) — a couple of entries survive runtime upgrades. */
const MAX_CACHE_ENTRIES = 3;

export const getCachedMetadata = async (
	codeHash: string,
): Promise<Uint8Array | null> => {
	try {
		const cached = await get<CachedMetadata>(codeHash, metadataStore);

		if (!cached) {
			console.debug("[metadataCache] cache MISS for codeHash:", codeHash);
			return null;
		}

		console.debug("[metadataCache] cache HIT for codeHash:", codeHash);
		return cached.metadata;
	} catch (error) {
		console.warn("Failed to get cached metadata:", error);
		return null;
	}
};

const pruneOldestEntries = async (): Promise<void> => {
	try {
		const allEntries = await entries<string, CachedMetadata>(metadataStore);

		if (allEntries.length <= MAX_CACHE_ENTRIES) return;

		const sorted = allEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);
		const entriesToDelete = sorted.slice(
			0,
			allEntries.length - MAX_CACHE_ENTRIES,
		);

		await Promise.all(entriesToDelete.map(([key]) => del(key, metadataStore)));

		console.debug(
			"[metadataCache] Pruned",
			entriesToDelete.length,
			"old entries",
		);
	} catch (error) {
		console.warn("Failed to prune old metadata cache entries:", error);
	}
};

export const setCachedMetadata = (
	codeHash: string,
	metadata: Uint8Array,
): void => {
	const entry: CachedMetadata = {
		metadata,
		timestamp: Date.now(),
	};

	set(codeHash, entry, metadataStore)
		.then(() => pruneOldestEntries())
		.catch((error) => {
			console.warn("Failed to cache metadata:", error);
		});
};
