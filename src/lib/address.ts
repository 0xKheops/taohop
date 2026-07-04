import { blake2b } from "@noble/hashes/blake2.js";
import { isAddress as isSolanaAddress } from "@solana/kit";
import { AccountId, getSs58AddressInfo, type SS58String } from "polkadot-api";
import { fromHex } from "polkadot-api/utils";
import { isAddress as isEvmAddress } from "viem";
import type { Platform } from "@/config/chains";

const accountIdCodec = AccountId();

const isValidSs58Address = (address: string): boolean =>
	getSs58AddressInfo(address).isValid;

export const isValidAddress = (
	platform: Platform,
	address: string,
): boolean => {
	switch (platform) {
		case "polkadot":
			return isValidSs58Address(address);
		case "ethereum":
			return isEvmAddress(address);
		case "solana":
			return isSolanaAddress(address);
	}
};

/**
 * Bittensor EVM "mirror" account: the substrate account owned by an H160 key.
 * ss58 = SS58Encode(blake2_256("evm:" ++ h160_bytes)), prefix 42.
 *
 * @see https://docs.learnbittensor.org/evm-tutorials/convert-h160-to-ss58
 */
export const evmToBittensorMirror = (evmAddress: `0x${string}`): SS58String => {
	const prefix = new TextEncoder().encode("evm:");
	const h160 = fromHex(evmAddress);
	const input = new Uint8Array(prefix.length + h160.length);
	input.set(prefix, 0);
	input.set(h160, prefix.length);
	const publicKey = blake2b(input, { dkLen: 32 });
	return accountIdCodec.dec(publicKey);
};

/** Raw 32-byte public key of an ss58 address (for the BalanceTransfer precompile). */
export const ss58ToPublicKey = (address: SS58String): Uint8Array => {
	const info = getSs58AddressInfo(address);
	if (!info.isValid) throw new Error("Invalid SS58 address");
	return info.publicKey;
};

export const shortenAddress = (
	address: string,
	length = address.startsWith("0x") ? 6 : 8,
) => `${address.slice(0, length)}…${address.slice(-length)}`;
