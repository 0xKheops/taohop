import type { ChainId } from "./chains";

export type TokenSymbol = "TAO" | "vTAO";

export type TokenId = `${ChainId}:${TokenSymbol}`;

export type TokenDef = {
	id: TokenId;
	symbol: TokenSymbol;
	name: string;
	chainId: ChainId;
	decimals: number;
	logo: string;
} & (
	| { kind: "native" }
	| { kind: "erc20"; address: `0x${string}` }
	| { kind: "spl"; mint: string }
);

// vTAO LayerZero OFT (TAO.app "Virtual TAO"). Same address on Ethereum & Base.
// Verified on Base Blockscout; Ethereum address from Snowbridge PR #1606.
// TODO(verify): vTAO address on Bittensor EVM + LayerZero EIDs (see .docs/PRD.md §9).
const VTAO_OFT_ADDRESS = "0xe9f6D9898f9269B519E1435E6ebafF766c7f46BF" as const;

// Canonical Wormhole NTT TAO on Solana (Sunrise). Beware imposter mints.
const TAO_SOLANA_MINT = "taoC6xyv2v8tDLcev4uaGUgV4vdQsWJrGft2kcBRrBY";

export const TOKENS: Partial<Record<TokenId, TokenDef>> = {
	"bittensor:TAO": {
		id: "bittensor:TAO",
		symbol: "TAO",
		name: "TAO",
		chainId: "bittensor",
		decimals: 9,
		kind: "native",
		logo: "/img/tokens/tao.svg",
	},
	"bittensorEvm:TAO": {
		id: "bittensorEvm:TAO",
		symbol: "TAO",
		name: "TAO",
		chainId: "bittensorEvm",
		decimals: 18,
		kind: "native",
		logo: "/img/tokens/tao.svg",
	},
	"ethereum:vTAO": {
		id: "ethereum:vTAO",
		symbol: "vTAO",
		name: "Virtual TAO",
		chainId: "ethereum",
		decimals: 18,
		kind: "erc20",
		address: VTAO_OFT_ADDRESS,
		logo: "/img/tokens/vtao.svg",
	},
	"base:vTAO": {
		id: "base:vTAO",
		symbol: "vTAO",
		name: "Virtual TAO",
		chainId: "base",
		decimals: 18,
		kind: "erc20",
		address: VTAO_OFT_ADDRESS,
		logo: "/img/tokens/vtao.svg",
	},
	"solana:TAO": {
		id: "solana:TAO",
		symbol: "TAO",
		name: "TAO (Wormhole)",
		chainId: "solana",
		decimals: 9,
		kind: "spl",
		mint: TAO_SOLANA_MINT,
		logo: "/img/tokens/tao.svg",
	},
	// vTAO on Bittensor EVM exists (OFT home) but its address is unverified —
	// intentionally absent until confirmed (PRD §9).
};

export const getToken = (id: TokenId): TokenDef => {
	const token = TOKENS[id];
	if (!token) throw new Error(`Unknown token: ${id}`);
	return token;
};

export const getTokensForChain = (chainId: ChainId): TokenDef[] =>
	Object.values(TOKENS).filter(
		(t): t is TokenDef => !!t && t.chainId === chainId,
	);
