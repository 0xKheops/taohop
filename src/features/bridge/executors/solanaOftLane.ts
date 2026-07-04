import { type AccountMeta, AccountRole, address } from "@solana/kit";

/**
 * Vendored account templates for the TAO OFT lane
 * solana (30168) → bittensorEvm (30374).
 *
 * The LayerZero Solana SDK resolves these account lists at runtime from
 * on-chain endpoint/ULN/executor config. For a fixed lane (fixed OFT store
 * and destination EID) every account is static except the sender: slot 0 is
 * the signing owner, slot 3 their TAO token account, slot 22 the owner again
 * as the native-fee payer inside the endpoint CPI.
 *
 * Dumped from @layerzerolabs/oft-v2-solana-sdk 3.0.168 with two different
 * payers to prove which slots vary — regenerate with
 * scripts/dump-oft-lane.mjs (instructions inside).
 * Byte-verified against the delivered mainnet transaction
 * WAqyRmxqz9QjsAfudjcS8Nq6M6YaC7JpjQDiaQ8aopvDPuhDoYjt5byJ7wFamU1Ystfm4JRumK2wYh5ogYWtkma.
 * If LayerZero rotates the lane's send library / executor / DVN config these
 * templates must be re-dumped — quotes/sends fail loudly (the fee estimate
 * simulates this quote on every render), funds are never at risk.
 */

/** Anchor discriminator for oft::send. */
export const SEND_DISCRIMINATOR = new Uint8Array([
	102, 251, 20, 187, 65, 75, 12, 69,
]);

/** Anchor discriminator for oft::quote_send. */
export const QUOTE_SEND_DISCRIMINATOR = new Uint8Array([
	207, 0, 49, 214, 160, 211, 76, 211,
]);

const R = (addr: string): AccountMeta => ({
	address: address(addr),
	role: AccountRole.READONLY,
});
const W = (addr: string): AccountMeta => ({
	address: address(addr),
	role: AccountRole.WRITABLE,
});

/** Placeholder slots substituted per sender when building a send. */
export const SEND_SLOT_SIGNER = 0;
export const SEND_SLOT_TOKEN_SOURCE = 3;
export const SEND_SLOT_FEE_PAYER = 22;

export const SEND_ACCOUNT_TEMPLATE: readonly AccountMeta[] = [
	R("11111111111111111111111111111111"), // SEND_SLOT_SIGNER placeholder
	W("JT6nhHYre8hUymLBTW6zui425C5zbK4aZhcnvnE72x8"), // peer config
	W("8vJKzzabD9t15SwVa8aQUEJH37Xk5nS9eaQ4WgojZdDg"), // oft store
	W("11111111111111111111111111111111"), // SEND_SLOT_TOKEN_SOURCE placeholder
	W("FeiTZPe7uJYJLux1CahrQnU94SjSXQ6zsdgobLm658LN"), // token escrow
	W("taoC6xyv2v8tDLcev4uaGUgV4vdQsWJrGft2kcBRrBY"), // TAO mint
	R("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), // token program
	R("CZr3YE5mNB5nXrA6yzK3DdaeGSxbMUt8CQeq4MG9usxv"), // oft event authority
	R("tao3RyGP8XiiWQKmBzkiULmPoMewWjq65b46H4rTAQQ"), // oft program
	R("76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6"), // endpoint program
	R("8vJKzzabD9t15SwVa8aQUEJH37Xk5nS9eaQ4WgojZdDg"),
	R("7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH"),
	R("FoDnQkwZX1zi6WAP1evqKYTbeu8N2g7mEjbeBv7hpXXa"),
	R("FN7XushjTMppsw4n9V5KM3ou7QpyxYWbLm7Tgtr74p98"),
	R("526PeNZfw8kSnDU4nmzJFVJzJWNhwmZykEyJr5XWz5Fv"),
	R("2uk9pQh3tB5ErV7LGQJcbWjb4KeJ2UJki5qJZ8QG56G3"),
	W("FnJseVjPYDr9JYgqK4tySYYzSNZUCvxoKQvwB7j1vEe2"),
	R("F8E8QGhKmHEx2esh5LpVizzcP4cHYhzXdXTwg9w3YYY2"),
	R("76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6"),
	R("2XgGZG4oP29U3w5h4nTk1V2LFHL23zKDPJjs3psGzLKQ"),
	R("3LecQ6ugec9qqdwJgtJspuzmRbbEshXF8zvewDuEpb2i"),
	R("FzxKkGtzUfXTEEwne6yT2wFa1qPwdK2YSS8gp4Y5Zyva"),
	W("11111111111111111111111111111111"), // SEND_SLOT_FEE_PAYER placeholder
	R("7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH"),
	R("11111111111111111111111111111111"), // system program
	R("7n1YeBMVEUCJ4DscKAcpVQd6KXU7VpcEcc15ZuMcL4U3"),
	R("7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH"),
	R("6doghB248px58JSSwG4qejQ46kFMW4AMj7vzJnWZHNZn"),
	W("AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK"),
	R("8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP"),
	R("CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ"),
	R("HtEYV4xB4wvsj5fgTkcfuChYpvGYzgzwvNhgDZQNh7wW"),
	W("4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb"),
	R("8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP"),
	R("CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ"),
	R("5KAALa8AEEKnW6p6AacdnqNDmGMpfhwR7AEyWs1gUvsT"),
	W("7jMeX5mzXnSSKYd8DxBDP4xMnkNFZZZm5W28FWUTbwU3"),
	R("8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP"),
	R("CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ"),
	R("4fs6aL12L18K5giDy9Dgxgrb3aNRYiuRV2a7JPPj3e7F"),
	W("GPjyWr8vCotGuFubDpTxDxy9Vj1ZeEN4F2dwRmFiaGab"),
	R("8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP"),
	R("CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ"),
	R("68C5DkFUS2BJwvjhi25s6WgJK5oi6f1TrDXPDvLK6c1b"),
	W("29EKzmCscUg8mf4f5uskwMqvu2SXM8hKF1gWi1cCBoKT"),
	R("8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP"),
	R("CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ"),
	R("FAAWGvgG5KNinoW4UJDF2MMU33DXeUb16tqapAgNbowR"),
	W("FxFxe8j7e2xgpP9bw8LUehmz7DoQXaNFadJMEUKwBcRs"),
	R("8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP"),
	R("CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ"),
	R("4Z436PCb83Ft9dMRtwZ2mK7ZQtqVhbFEC3BYna9qB7B9"),
	W("HR9NQKK1ynW9NzgdM37dU5CBtqRHTukmbMKS7qkwSkHX"),
	R("8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP"),
	R("CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ"),
];

/** quote_send accounts are fully static — no sender-dependent slots. */
export const QUOTE_ACCOUNT_TEMPLATE: readonly AccountMeta[] = [
	R("8vJKzzabD9t15SwVa8aQUEJH37Xk5nS9eaQ4WgojZdDg"), // oft store
	R("JT6nhHYre8hUymLBTW6zui425C5zbK4aZhcnvnE72x8"), // peer config
	R("taoC6xyv2v8tDLcev4uaGUgV4vdQsWJrGft2kcBRrBY"), // TAO mint
	R("76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6"), // endpoint program
	R("7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH"),
	R("FoDnQkwZX1zi6WAP1evqKYTbeu8N2g7mEjbeBv7hpXXa"),
	R("FN7XushjTMppsw4n9V5KM3ou7QpyxYWbLm7Tgtr74p98"),
	R("526PeNZfw8kSnDU4nmzJFVJzJWNhwmZykEyJr5XWz5Fv"),
	R("2uk9pQh3tB5ErV7LGQJcbWjb4KeJ2UJki5qJZ8QG56G3"),
	R("FnJseVjPYDr9JYgqK4tySYYzSNZUCvxoKQvwB7j1vEe2"),
	R("2XgGZG4oP29U3w5h4nTk1V2LFHL23zKDPJjs3psGzLKQ"),
	R("3LecQ6ugec9qqdwJgtJspuzmRbbEshXF8zvewDuEpb2i"),
	R("FzxKkGtzUfXTEEwne6yT2wFa1qPwdK2YSS8gp4Y5Zyva"),
	R("6doghB248px58JSSwG4qejQ46kFMW4AMj7vzJnWZHNZn"),
	R("AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK"),
	R("8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP"),
	R("CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ"),
	R("HtEYV4xB4wvsj5fgTkcfuChYpvGYzgzwvNhgDZQNh7wW"),
	R("4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb"),
	R("8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP"),
	R("CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ"),
	R("5KAALa8AEEKnW6p6AacdnqNDmGMpfhwR7AEyWs1gUvsT"),
	R("7jMeX5mzXnSSKYd8DxBDP4xMnkNFZZZm5W28FWUTbwU3"),
	R("8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP"),
	R("CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ"),
	R("4fs6aL12L18K5giDy9Dgxgrb3aNRYiuRV2a7JPPj3e7F"),
	R("GPjyWr8vCotGuFubDpTxDxy9Vj1ZeEN4F2dwRmFiaGab"),
	R("8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP"),
	R("CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ"),
	R("68C5DkFUS2BJwvjhi25s6WgJK5oi6f1TrDXPDvLK6c1b"),
	R("29EKzmCscUg8mf4f5uskwMqvu2SXM8hKF1gWi1cCBoKT"),
	R("8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP"),
	R("CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ"),
	R("FAAWGvgG5KNinoW4UJDF2MMU33DXeUb16tqapAgNbowR"),
	R("FxFxe8j7e2xgpP9bw8LUehmz7DoQXaNFadJMEUKwBcRs"),
	R("8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP"),
	R("CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ"),
	R("4Z436PCb83Ft9dMRtwZ2mK7ZQtqVhbFEC3BYna9qB7B9"),
	R("HR9NQKK1ynW9NzgdM37dU5CBtqRHTukmbMKS7qkwSkHX"),
	R("8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP"),
	R("CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ"),
];
