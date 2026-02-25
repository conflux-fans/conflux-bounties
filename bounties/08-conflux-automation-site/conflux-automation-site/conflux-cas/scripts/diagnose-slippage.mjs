/**
 * diagnose-slippage.mjs
 * Queries the live Swappi pool to diagnose the "Slippage exceeded" failures.
 *
 * Usage:  node scripts/diagnose-slippage.mjs
 */

const RPC = 'https://evm.confluxrpc.com';
const ROUTER = '0xE37B52296b0bAA91412cD0Cd97975B0805037B84';
const FACTORY = '0xe2a6f7c0ce4d5d300f97aa7e125455f5cd3342f5';
const USDC = '0x6963efed0ab40f6c3d7bda44a05dcf1437c44372';
const WCFX = '0x14b2D3bC65e74DAE1030EAFd8ac30c533c976A9b';
const USDT = '0x22f41abf77905f50df398f21213290597e7414dd';

// ── ABI helpers ──────────────────────────────────────────────────────────────

function addr(a) {
  return a.slice(2).toLowerCase().padStart(64, '0');
}
function u256(n) {
  return BigInt(n).toString(16).padStart(64, '0');
}

async function rpcCall(to, data) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{ to, data }, 'latest'],
      id: 1,
    }),
  });
  const json = await r.json();
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result;
}

async function decimals(token) {
  const res = await rpcCall(token, '0x313ce567');
  return res && res !== '0x' ? parseInt(res, 16) : null;
}

async function symbol(token) {
  // symbol() selector: 0x95d89b41 — returns a padded string
  const res = await rpcCall(token, '0x95d89b41');
  if (!res || res === '0x') return '?';
  try {
    // ABI decode string: offset(32), length(32), data
    const offset = parseInt(res.slice(2, 66), 16) * 2;
    const len = parseInt(res.slice(2 + offset, 2 + offset + 64), 16);
    const hex = res.slice(2 + offset + 64, 2 + offset + 64 + len * 2);
    return Buffer.from(hex, 'hex').toString('utf8');
  } catch {
    return '?';
  }
}

async function getPair(t0, t1) {
  const data = `0xe6a43905${addr(t0)}${addr(t1)}`;
  const res = await rpcCall(FACTORY, data);
  return `0x${res.slice(-40)}`;
}

async function getReserves(pair) {
  // getReserves() → (uint112 r0, uint112 r1, uint32 ts)  selector: 0x0902f1ac
  const res = await rpcCall(pair, '0x0902f1ac');
  if (!res || res === '0x') return null;
  return {
    r0: BigInt(`0x${res.slice(2, 66)}`),
    r1: BigInt(`0x${res.slice(66, 130)}`),
  };
}

async function getAmountsOut(amtIn, path) {
  // getAmountsOut(uint256,address[]) selector: 0xd06ca61f
  const data =
    '0xd06ca61f' +
    u256(amtIn) +
    '0000000000000000000000000000000000000000000000000000000000000040' +
    u256(path.length) +
    path.map(addr).join('');
  const res = await rpcCall(ROUTER, data);
  if (!res || res === '0x') return null;
  const len = parseInt(res.slice(66, 130), 16);
  const values = [];
  for (let i = 0; i < len; i++) {
    values.push(BigInt(`0x${res.slice(130 + i * 64, 130 + (i + 1) * 64)}`));
  }
  return values;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const fmt = (wei, dec = 18) =>
  (Number(wei) / 10 ** dec).toFixed(dec === 18 ? 6 : 4);

async function analyseJob(
  label,
  tokenIn,
  tokenOut,
  amountIn,
  minAmountOut,
  targetPrice
) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`JOB: ${label}`);
  console.log(
    `tokenIn  : ${tokenIn} (${await symbol(tokenIn)}, ${await decimals(tokenIn)} dec)`
  );
  console.log(
    `tokenOut : ${tokenOut} (${await symbol(tokenOut)}, ${await decimals(tokenOut)} dec)`
  );
  console.log(`amountIn : ${amountIn} (${fmt(amountIn)} tokens)`);
  console.log(`minOut   : ${minAmountOut} (${fmt(minAmountOut)} tokens)`);
  console.log(
    `targetPx : ${targetPrice} (${fmt(targetPrice)} — 1 tokenIn = this many tokenOut)`
  );

  // Pair info
  const pair = await getPair(tokenIn, tokenOut);
  const zeroAddr = `0x${'0'.repeat(40)}`;
  if (pair === zeroAddr) {
    console.log(`\n❌  PAIR DOES NOT EXIST on this factory`);
    return;
  }
  console.log(`\nPair     : ${pair}`);
  const res = await getReserves(pair);
  if (res) {
    console.log(`Reserve0 : ${res.r0} (${fmt(res.r0)} tokens)`);
    console.log(`Reserve1 : ${res.r1} (${fmt(res.r1)} tokens)`);
    const spotPrice = (res.r1 * 10n ** 18n) / res.r0;
    console.log(
      `Spot price (r1/r0 × 1e18): ${spotPrice} (${fmt(spotPrice)} tokenOut per tokenIn)`
    );
  }

  // Oracle quote (1 unit of tokenIn)
  const oracle = await getAmountsOut(10n ** 18n, [tokenIn, tokenOut]).catch(
    () => null
  );
  console.log(
    `\nOracle getAmountsOut(1e18): ${oracle ? `${oracle[1]} = ${fmt(oracle[1])} tokenOut` : 'FAILED'}`
  );
  console.log(
    `Oracle >= targetPrice?     ${oracle ? (oracle[1] >= BigInt(targetPrice) ? '✅ YES (price condition would pass)' : '❌ NO (price condition would fail)') : 'N/A'}`
  );

  // Actual swap quote for this specific amountIn
  const quote = await getAmountsOut(BigInt(amountIn), [
    tokenIn,
    tokenOut,
  ]).catch(() => null);
  if (quote) {
    const amtOut = quote[1];
    console.log(
      `\nSwap quote getAmountsOut(${amountIn}): ${amtOut} = ${fmt(amtOut)} tokenOut`
    );
    console.log(
      `minAmountOut required              : ${minAmountOut} = ${fmt(minAmountOut)} tokenOut`
    );
    const diff =
      (Number(amtOut - BigInt(minAmountOut)) / Number(BigInt(minAmountOut))) *
      100;
    console.log(`Difference                         : ${diff.toFixed(2)}%`);
    console.log(
      `Swap would PASS slippage check?    : ${amtOut >= BigInt(minAmountOut) ? '✅ YES' : '❌ NO — Slippage exceeded'}`
    );
  } else {
    console.log(
      `\n❌  getAmountsOut REVERTED — pair may not exist or has zero liquidity`
    );
  }
}

(async () => {
  console.log('Conflux eSpace Mainnet — Swappi slippage diagnosis');
  console.log('RPC:', RPC);

  await analyseJob(
    'Job 1 (0.1 USDC → WCFX)',
    USDC,
    WCFX,
    '100000000000000000',
    '1864630000000000000',
    '18740000000000000000'
  );

  await analyseJob(
    'Job 2 (0.01 USDC → USDT?)',
    USDC,
    USDT,
    '10000000000000000',
    '10834119190000000000',
    '1088840000000000000000'
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
