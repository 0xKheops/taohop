/**
 * Build-time stub for non-Solana chain SDKs barrel-imported by
 * @layerzerolabs/lz-utilities (initia, ton, aptos). Those code paths are
 * unreachable for our Solana OFT sends; stubbing keeps ~10MB out of the
 * bundle. Any accidental runtime use throws loudly.
 */
function make(path) {
	const fn = () => {
		throw new Error(`Stubbed chain SDK used at runtime: ${path}`);
	};
	return new Proxy(fn, {
		get: (_target, prop) =>
			prop === "__esModule" ? true : make(`${path}.${String(prop)}`),
		construct: () => {
			throw new Error(`Stubbed chain SDK instantiated: ${path}`);
		},
		apply: () => {
			throw new Error(`Stubbed chain SDK called: ${path}`);
		},
	});
}
module.exports = make("stub");
