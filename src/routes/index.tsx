import { createFileRoute } from "@tanstack/react-router";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>Bridge</CardTitle>
				<CardDescription>
					Move TAO and vTAO across Bittensor, Ethereum, Base and Solana.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<p className="text-sm text-muted-foreground">
					Bridge form coming in M2.
				</p>
			</CardContent>
		</Card>
	);
}
