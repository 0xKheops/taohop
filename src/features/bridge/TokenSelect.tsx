import type { FC } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { getChain } from "@/config/chains";
import { getToken, TOKENS, type TokenDef, type TokenId } from "@/config/tokens";

const tokenLabel = (token: TokenDef) =>
	`${token.symbol} · ${getChain(token.chainId).name}`;

export const TokenSelect: FC<{
	value: TokenId;
	onChange: (value: TokenId) => void;
	"aria-label": string;
}> = ({ value, onChange, "aria-label": ariaLabel }) => {
	return (
		<Select
			value={value}
			onValueChange={(v) => {
				if (v) onChange(v as TokenId);
			}}
		>
			<SelectTrigger aria-label={ariaLabel} className="w-full">
				<SelectValue>{tokenLabel(getToken(value))}</SelectValue>
			</SelectTrigger>
			<SelectContent>
				{Object.values(TOKENS)
					.filter((t): t is TokenDef => !!t)
					.map((token) => (
						<SelectItem key={token.id} value={token.id}>
							{tokenLabel(token)}
						</SelectItem>
					))}
			</SelectContent>
		</Select>
	);
};
