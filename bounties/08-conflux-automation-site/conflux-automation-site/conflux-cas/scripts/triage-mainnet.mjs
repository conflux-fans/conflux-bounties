/**
 * triage-mainnet.mjs — zero external dependencies (Node 18+ fetch)
 *
 * Usage:
 *   node scripts/triage-mainnet.mjs [jobId]
 *
 * Example:
 *   node scripts/triage-mainnet.mjs 0xbbb1ec61a7107882ccb1eb18ac0d7aa4a2aad9dcf50a1c3b9522094d37d4a221
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(resolve(__dir, '../.env'), 'utf8').split(
  '\n'
)) {
  const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

const RPC =
  process.env.CONFLUX_ESPACE_MAINNET_RPC ?? 'https://evm.confluxrpc.com';
const AM = (process.env.AUTOMATION_MANAGER_ADDRESS ?? '').toLowerCase();
const ROUTER = '0xe37b52296b0baa91412cd0cd97975b0805037b84';
const FACTORY = '0xe2a6f7c0ce4d5d300f97aa7e125455f5cd3342f5';
const KEEPER = '0x623928228700438166d4bb226898425d13faa0dc';
const JOB_ID = (
  process.argv[2] ??
  '0xbbb1ec61a7107882ccb1eb18ac0d7aa4a2aad9dcf50a1c3b9522094d37d4a221'
).toLowerCase();

const ok = (s) => `\x1b[32m✅  ${s}\x1b[0m`;
const fail = (s) => `\x1b[31m❌  ${s}\x1b[0m`;
const warn = (s) => `\x1b[33m⚠️   ${s}\x1b[0m`;
const hdr = (s) =>
  `\n\x1b[1m── ${s} ${'─'.repeat(Math.max(0, 52 - s.length))}\x1b[0m`;
const fmt = (v, d = 18) => (Number(BigInt(v)) / 10 ** Number(d)).toFixed(6);
const hex40 = (h) => `0x${h.slice(-40)}`;

let _id = 1;
async function rpc(calls) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      calls.map((c, i) => ({ jsonrpc: '2.0', id: _id + i, ...c }))
    ),
  });
  _id += calls.length;
  const j = await r.json();
  return (Array.isArray(j) ? j : [j])
    .sort((a, b) => a.id - b.id)
    .map((x) => x.result ?? x.error);
}

const pad32 = (n) => BigInt(n).toString(16).padStart(64, '0');
const padA = (a) => a.replace(/^0x/, '').toLowerCase().padStart(64, '0');
const dec256 = (r) => (r && r.length >= 66 ? BigInt(r) : null);
const decA = (r) => (r && r.length >= 66 ? hex40(r) : null);
const decB = (r) => (r && r.length >= 66 ? r.slice(-1) !== '0' : null);
const decS = (r) => {
  try {
    const d = Buffer.from(r.slice(2), 'hex');
    const o = Number(BigInt(`0x${d.slice(0, 32).toString('hex')}`));
    const l = Number(BigInt(`0x${d.slice(o, o + 32).toString('hex')}`));
    return d.slice(o + 32, o + 32 + l).toString('utf8');
  } catch {
    return r?.slice(0, 20) ?? 'ERR';
  }
};
const slots = (r) => {
  const d = r?.slice(2) ?? '';
  return Array.from({ length: Math.floor(d.length / 64) }, (_, i) =>
    d.slice(i * 64, i * 64 + 64)
  );
};

const SEL = {
  paused: '5c975abb', // paused()
  keepers: '3bbd64bc', // keepers(address)
  priceAdapter: '93098382', // priceAdapter()
  jobs: '38ed7cfc', // jobs(bytes32)
  limitOrders: 'ca697db4', // limitOrders(bytes32)
  getPrice: 'ac41865a', // getPrice(address,address)
  factory: 'c45a0155', // factory()
  router: 'f887ea40', // router()
  balanceOf: '70a08231', // balanceOf(address)
  allowance: 'dd62ed3e', // allowance(address,address)
  decimals: '313ce567', // decimals()
  symbol: '95d89b41', // symbol()
  getPair: 'e6a43905', // getPair(address,address)
  getAmountsOut: 'd06ca61f', // getAmountsOut(uint256,address[])
  executeLimitOrder: 'dc4c46ab', // executeLimitOrder(bytes32,address,bytes)
};

console.log(`\n${'═'.repeat(62)}`);
console.log(` Mainnet Triage`);
console.log(`${'═'.repeat(62)}`);
console.log(` JobId:  ${JOB_ID}`);
console.log(` Keeper: ${KEEPER}`);
console.log(` AM:     ${AM}`);
console.log(` RPC:    ${RPC}`);

// 1. AM state
console.log(hdr('1. AutomationManager'));
const [r_pause, r_keeper, r_pa] = await rpc([
  {
    method: 'eth_call',
    params: [{ to: AM, data: `0x${SEL.paused}` }, 'latest'],
  },
  {
    method: 'eth_call',
    params: [{ to: AM, data: `0x${SEL.keepers}${padA(KEEPER)}` }, 'latest'],
  },
  {
    method: 'eth_call',
    params: [{ to: AM, data: `0x${SEL.priceAdapter}` }, 'latest'],
  },
]);
const paAddr = decA(r_pa);
console.log(decB(r_pause) ? fail('Contract PAUSED') : ok('Not paused'));
console.log(
  decB(r_keeper)
    ? ok(`Keeper authorised`)
    : fail(`Keeper NOT authorised: ${KEEPER}`)
);
console.log(`    priceAdapter: ${paAddr}`);

// 2. PriceAdapter
console.log(hdr('2. PriceAdapter'));
if (!paAddr)
  console.log(
    fail(
      'Cannot read priceAdapter address from AM — wrong selector or AM address'
    )
  );
const [r_paf, r_par] = paAddr
  ? await rpc([
      {
        method: 'eth_call',
        params: [{ to: paAddr, data: `0x${SEL.factory}` }, 'latest'],
      },
      {
        method: 'eth_call',
        params: [{ to: paAddr, data: `0x${SEL.router}` }, 'latest'],
      },
    ])
  : [null, null];
const paF = decA(r_paf),
  paR = decA(r_par);
console.log(
  paF?.toLowerCase() === FACTORY
    ? ok(`factory: ${paF}`)
    : fail(`factory: ${paF}  (expected ${FACTORY})`)
);
console.log(
  paR?.toLowerCase() === ROUTER
    ? ok(`router:  ${paR}`)
    : fail(`router:  ${paR}  (expected ${ROUTER})`)
);

// 3. Job state
console.log(hdr('3. Job on-chain state'));
const [r_job, r_lo] = await rpc([
  {
    method: 'eth_call',
    params: [{ to: AM, data: `0x${SEL.jobs}${padA(JOB_ID)}` }, 'latest'],
  },
  {
    method: 'eth_call',
    params: [{ to: AM, data: `0x${SEL.limitOrders}${padA(JOB_ID)}` }, 'latest'],
  },
]);
const js = slots(typeof r_job === 'string' ? r_job : '0x'),
  ls = slots(typeof r_lo === 'string' ? r_lo : '0x');
const owner = js[1] ? `0x${js[1].slice(-40)}` : null;
const status = js[3] ? Number(BigInt(`0x${js[3]}`)) : -1;
const expiresAt = js[5] ? BigInt(`0x${js[5]}`) : 0n;
const maxSlipBps = js[6] ? BigInt(`0x${js[6]}`) : 0n;
const tokenIn = ls[0] ? `0x${ls[0].slice(-40)}` : null;
const tokenOut = ls[1] ? `0x${ls[1].slice(-40)}` : null;
const amountIn = ls[2] ? BigInt(`0x${ls[2]}`) : 0n;
const minAmountOut = ls[3] ? BigInt(`0x${ls[3]}`) : 0n;
const targetPrice = ls[4] ? BigInt(`0x${ls[4]}`) : 0n;
const triggerAbove = ls[5] ? ls[5].slice(-1) !== '0' : false;
const ST = ['ACTIVE', 'EXECUTED', 'CANCELLED', 'EXPIRED'];

if (!owner || owner === `0x${'0'.repeat(40)}`) {
  console.log(
    fail('Job NOT FOUND on-chain — jobId may be wrong or from wrong network')
  );
} else {
  console.log(`    owner:         ${owner}`);
  console.log(
    status === 0
      ? ok('status: ACTIVE')
      : fail(`status: ${ST[status] ?? status} — not executable`)
  );
  console.log(`    tokenIn:       ${tokenIn}`);
  console.log(`    tokenOut:      ${tokenOut}`);
  console.log(`    amountIn:      ${fmt(amountIn)}`);
  console.log(`    minAmountOut:  ${fmt(minAmountOut)}`);
  console.log(`    targetPrice:   ${fmt(targetPrice)} tokenOut/tokenIn`);
  console.log(`    triggerAbove:  ${triggerAbove}`);
  console.log(
    `    maxSlipBps:    ${maxSlipBps} (${Number(maxSlipBps) / 100}%)`
  );
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (expiresAt > 0n)
    console.log(
      expiresAt < now
        ? fail(`EXPIRED at ${new Date(Number(expiresAt) * 1000).toISOString()}`)
        : ok(`expires: ${new Date(Number(expiresAt) * 1000).toISOString()}`)
    );
  else console.log(ok('expiresAt: none'));
}

// 4. Price condition
console.log(hdr('4. Price condition (oracle)'));
let currentPrice = 0n;
if (paAddr && tokenIn && tokenOut) {
  const [r_price] = await rpc([
    {
      method: 'eth_call',
      params: [
        {
          to: paAddr,
          data: `0x${SEL.getPrice}${padA(tokenIn)}${padA(tokenOut)}`,
        },
        'latest',
      ],
    },
  ]);
  currentPrice = dec256(r_price) ?? 0n;
  if (currentPrice === 0n) {
    console.log(
      fail('getPrice() = 0 — oracle broken or pair missing in factory')
    );
  } else {
    console.log(
      ok(
        `currentPrice: ${currentPrice} (${fmt(currentPrice)} tokenOut/tokenIn)`
      )
    );
    const condMet = triggerAbove
      ? currentPrice >= targetPrice
      : currentPrice <= targetPrice;
    const dir = triggerAbove ? '>=' : '<=';
    console.log(
      condMet
        ? ok(`condition MET: ${fmt(currentPrice)} ${dir} ${fmt(targetPrice)}`)
        : fail(
            `condition NOT MET: current ${fmt(currentPrice)} not ${dir} target ${fmt(targetPrice)}`
          )
    );
  }
} else {
  console.log(warn('Skipped — priceAdapter/tokenIn/tokenOut not available'));
}

// 5. Token info
console.log(hdr('5. Token info'));
let symIn = '?',
  symOut = '?',
  decIn = 18,
  decOut = 18;
if (tokenIn && tokenOut) {
  const [rSI, rDI, rSO, rDO] = await rpc([
    {
      method: 'eth_call',
      params: [{ to: tokenIn, data: `0x${SEL.symbol}` }, 'latest'],
    },
    {
      method: 'eth_call',
      params: [{ to: tokenIn, data: `0x${SEL.decimals}` }, 'latest'],
    },
    {
      method: 'eth_call',
      params: [{ to: tokenOut, data: `0x${SEL.symbol}` }, 'latest'],
    },
    {
      method: 'eth_call',
      params: [{ to: tokenOut, data: `0x${SEL.decimals}` }, 'latest'],
    },
  ]);
  symIn = decS(rSI);
  decIn = rDI && rDI.length >= 66 ? Number(BigInt(rDI)) : 18;
  symOut = decS(rSO);
  decOut = rDO && rDO.length >= 66 ? Number(BigInt(rDO)) : 18;
  console.log(`    tokenIn:  ${symIn} (${decIn}d)  ${tokenIn}`);
  console.log(`    tokenOut: ${symOut} (${decOut}d)  ${tokenOut}`);
}

// 6. Balance & allowance
console.log(hdr('6. Balance & allowance'));
if (owner && tokenIn) {
  const [rB, rA] = await rpc([
    {
      method: 'eth_call',
      params: [
        { to: tokenIn, data: `0x${SEL.balanceOf}${padA(owner)}` },
        'latest',
      ],
    },
    {
      method: 'eth_call',
      params: [
        { to: tokenIn, data: `0x${SEL.allowance}${padA(owner)}${padA(AM)}` },
        'latest',
      ],
    },
  ]);
  const bal = dec256(rB) ?? 0n,
    allw = dec256(rA) ?? 0n;
  console.log(`    ${symIn} balance:   ${fmt(bal, decIn)}  (raw: ${bal})`);
  console.log(
    bal >= amountIn
      ? ok(`balance OK (${fmt(bal, decIn)} >= ${fmt(amountIn, decIn)})`)
      : fail(
          `INSUFFICIENT balance: has ${fmt(bal, decIn)}, needs ${fmt(amountIn, decIn)}`
        )
  );
  console.log(`    allowance:      ${fmt(allw, decIn)}  (raw: ${allw})`);
  console.log(
    allw >= amountIn
      ? ok(`allowance OK (${fmt(allw, decIn)} >= ${fmt(amountIn, decIn)})`)
      : fail(
          `INSUFFICIENT allowance: has ${fmt(allw, decIn)}, needs ${fmt(amountIn, decIn)}`
        )
  );
}

// 7. Pair
console.log(hdr('7. Swappi pair'));
if (tokenIn && tokenOut) {
  const [rP] = await rpc([
    {
      method: 'eth_call',
      params: [
        {
          to: FACTORY,
          data: `0x${SEL.getPair}${padA(tokenIn)}${padA(tokenOut)}`,
        },
        'latest',
      ],
    },
  ]);
  const pair = decA(rP);
  const isNull = !pair || pair === `0x${'0'.repeat(40)}`;
  console.log(
    isNull ? fail(`No ${symIn}/${symOut} pair on factory`) : ok(`pair: ${pair}`)
  );
}

// 8. getAmountsOut
console.log(hdr('8. Router getAmountsOut'));
if (tokenIn && tokenOut && amountIn > 0n) {
  const cd =
    '0x' +
    SEL.getAmountsOut +
    pad32(amountIn) +
    pad32(64n) +
    pad32(2n) +
    padA(tokenIn) +
    padA(tokenOut);
  const [rA] = await rpc([
    { method: 'eth_call', params: [{ to: ROUTER, data: cd }, 'latest'] },
  ]);
  if (!rA || rA === '0x' || rA.code) {
    console.log(fail(`getAmountsOut failed: ${JSON.stringify(rA)}`));
  } else {
    const d = rA.slice(2);
    const amtOut = d.length >= 256 ? BigInt(`0x${d.slice(192, 256)}`) : 0n;
    console.log(
      ok(`routerAmountOut: ${amtOut} (${fmt(amtOut, decOut)} ${symOut})`)
    );
    console.log(
      amtOut >= minAmountOut
        ? ok(
            `slippage OK: ${fmt(amtOut, decOut)} >= minAmountOut ${fmt(minAmountOut, decOut)}`
          )
        : fail(
            `SLIPPAGE: got ${fmt(amtOut, decOut)}, need >= ${fmt(minAmountOut, decOut)}`
          )
    );
    const slipPct =
      minAmountOut > 0n ? Number((amtOut * 10000n) / minAmountOut) / 100 : 0;
    console.log(`    ratio: ${slipPct.toFixed(2)}% of minAmountOut`);
  }
}

// 9. Simulate executeLimitOrder via eth_call
console.log(hdr('9. Simulate executeLimitOrder (eth_call)'));
if (tokenIn && tokenOut && amountIn > 0n && owner) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
  const swapCD = Buffer.from(
    '38ed1739' +
      pad32(amountIn) +
      pad32(minAmountOut) +
      pad32(5n * 32n) + // path offset
      padA(owner) +
      pad32(deadline) +
      pad32(2n) +
      padA(tokenIn) +
      padA(tokenOut),
    'hex'
  );
  const swapLen = swapCD.length;
  const swapPad = Buffer.concat([
    swapCD,
    Buffer.alloc(Math.ceil(swapLen / 32) * 32 - swapLen),
  ]);
  // executeLimitOrder(bytes32,address,bytes): bytes arg starts at offset 3*32=96
  const calldata =
    '0x' +
    SEL.executeLimitOrder +
    JOB_ID.replace(/^0x/, '').padStart(64, '0') +
    padA(ROUTER) +
    pad32(3n * 32n) +
    pad32(BigInt(swapLen)) +
    swapPad.toString('hex');

  const [r_sim] = await rpc([
    {
      method: 'eth_call',
      params: [{ to: AM, data: calldata, from: KEEPER }, 'latest'],
    },
  ]);

  if (!r_sim || r_sim === '0x') {
    console.log(ok('eth_call returned 0x — WOULD SUCCEED'));
  } else if (r_sim?.code) {
    let reason = r_sim.message ?? JSON.stringify(r_sim);
    const revertData = r_sim.data ?? '';
    if (revertData.startsWith('0x08c379a0')) {
      const msgB = Buffer.from(revertData.slice(10), 'hex');
      const o = Number(BigInt(`0x${msgB.slice(0, 32).toString('hex')}`));
      const l = Number(BigInt(`0x${msgB.slice(o, o + 32).toString('hex')}`));
      reason = msgB.slice(o + 32, o + 32 + l).toString('utf8');
    }
    console.log(fail(`REVERT: "${reason}"`));
    if (reason.includes('Unauthorized'))
      console.log(warn('→ keeper wallet not in keepers[]'));
    if (reason.includes('Swap failed'))
      console.log(
        warn('→ Swappi router call reverted (deadline/slippage/no liquidity)')
      );
    if (reason.includes('Slippage exceeded'))
      console.log(warn('→ amountOut < minAmountOut'));
    if (reason.includes('SafeERC20'))
      console.log(warn('→ safeTransferFrom failed (balance/allowance)'));
    if (reason.includes('PriceConditionNotMet'))
      console.log(warn('→ price not at target yet'));
    if (reason.includes('JobNotActive'))
      console.log(warn('→ job is not ACTIVE on-chain'));
    if (reason.includes('JobExpired'))
      console.log(warn('→ job expiresAt has passed'));
  } else {
    console.log(warn(`unexpected: ${String(r_sim).slice(0, 100)}`));
  }
}

console.log(`\n${'═'.repeat(62)}\n`);
