import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { TOKENS, type TokenId } from "@/config/tokens";
import { BridgeForm } from "@/features/bridge/BridgeForm";
import { TransferHistory } from "@/features/bridge/TransferHistory";

const tokenIds = Object.keys(TOKENS) as [TokenId, ...TokenId[]];

const searchSchema = z.object({
	from: z.enum(tokenIds).catch("bittensor:TAO"),
	to: z.enum(tokenIds).catch("bittensorEvm:TAO"),
	amount: z
		.string()
		.regex(/^\d*\.?\d*$/)
		.catch(""),
});

export const Route = createFileRoute("/")({
	validateSearch: searchSchema,
	component: Home,
});

function Home() {
	const { from, to, amount } = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<div className="flex w-full flex-col items-center gap-6">
			<BridgeForm
				from={from}
				to={to}
				amount={amount}
				onParamsChange={(params) => navigate({ search: params, replace: true })}
			/>
			<TransferHistory
				onResume={(params) => navigate({ search: params, replace: true })}
			/>
		</div>
	);
}
