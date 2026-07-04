import { bittensor } from "@polkadot-api/descriptors";
import { createClient, type PolkadotClient, type TypedApi } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws";
import { BITTENSOR_WSS_ENDPOINTS } from "@/config/chains";
import { getCachedMetadata, setCachedMetadata } from "./metadataCache";

export type BittensorApi = TypedApi<typeof bittensor>;

let client: PolkadotClient | undefined;
let api: BittensorApi | undefined;

const getBittensorClient = (): PolkadotClient => {
	client ??= createClient(getWsProvider(BITTENSOR_WSS_ENDPOINTS), {
		getMetadata: getCachedMetadata,
		setMetadata: setCachedMetadata,
	});
	return client;
};

export const getBittensorApi = (): BittensorApi => {
	api ??= getBittensorClient().getTypedApi(bittensor);
	return api;
};
