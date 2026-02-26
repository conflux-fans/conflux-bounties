/** Mock API for e2e tests. Handles /v1/* routes. */
import http from 'http';
import { parse as parseUrl } from 'url';

const PORT = parseInt(process.env.PORT || '3099', 10);

const SAMPLE_CONTRACT = '0x1234567890123456789012345678901234567890';
const SAMPLE_CID = 'QmSampleCid1234567890abcdef';
const SAMPLE_CHECKSUM = '0x' + 'a'.repeat(64);

const mockMetadataSearch = [
  {
    id: 'sub-1',
    contractAddress: SAMPLE_CONTRACT,
    name: 'Sample DEX',
    description: 'A sample decentralized exchange contract.',
    tags: ['dex', 'amm'],
  },
  {
    id: 'sub-2',
    contractAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    name: 'Mock Lending',
    description: 'Lending protocol for testing.',
    tags: ['lending'],
  },
];

const mockMetadataRecord = (address: string) => ({
  contractAddress: address,
  version: 1,
  cid: SAMPLE_CID,
  checksum: SAMPLE_CHECKSUM,
  status: 'Approved',
});

const mockFullMetadata = (address: string) => ({
  ...mockMetadataRecord(address),
  name: 'Sample DEX',
  description: 'A sample decentralized exchange contract.',
  website: 'https://example.com',
  tags: ['dex', 'amm'],
  abi: [
    {
      type: 'function',
      name: 'balanceOf',
      inputs: [{ type: 'address', name: 'account' }],
      stateMutability: 'view',
    },
    {
      type: 'function',
      name: 'transfer',
      inputs: [
        { type: 'address', name: 'to' },
        { type: 'uint256', name: 'amount' },
      ],
      stateMutability: 'nonpayable',
    },
  ],
});

const mockSubmissions = [
  {
    id: 'sub-v2',
    contractAddress: SAMPLE_CONTRACT,
    status: 'APPROVED',
    cid: 'QmVersion2Cid',
    checksum: SAMPLE_CHECKSUM,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    version: 2,
  },
  {
    id: 'sub-v1',
    contractAddress: SAMPLE_CONTRACT,
    status: 'APPROVED',
    cid: SAMPLE_CID,
    checksum: SAMPLE_CHECKSUM,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    version: 1,
  },
];

const server = http.createServer((req, res) => {
  const parsed = parseUrl(req.url || '', true);
  const path = parsed.pathname || '';
  const method = req.method || 'GET';

  const send = (status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  const sendError = (status: number, message: string) => {
    send(status, { error: message });
  };

  if (method === 'GET' && path === '/v1/metadata/') {
    const q = (parsed.query?.q as string) || '';
    const tag = (parsed.query?.tag as string) || '';
    let results = [...mockMetadataSearch];
    if (q) {
      results = results.filter(
        (r) =>
          (r.name?.toLowerCase().includes(q.toLowerCase()) ||
            r.description?.toLowerCase().includes(q.toLowerCase())) ??
          false
      );
    }
    if (tag) {
      results = results.filter((r) => r.tags?.some((t) => t.toLowerCase() === tag.toLowerCase()));
    }
    return send(200, results);
  }

  const metadataMatch = path.match(/^\/v1\/metadata\/(0x[a-fA-F0-9]{40})$/);
  if (method === 'GET' && metadataMatch) {
    const addr = metadataMatch[1];
    const known = [SAMPLE_CONTRACT, '0xabcdef1234567890abcdef1234567890abcdef12'].map((a) => a.toLowerCase());
    if (!known.includes(addr.toLowerCase())) {
      res.writeHead(404);
      res.end();
      return;
    }
    return send(200, mockMetadataRecord(addr));
  }

  const fullMatch = path.match(/^\/v1\/metadata\/(0x[a-fA-F0-9]{40})\/full$/);
  if (method === 'GET' && fullMatch) {
    const addr = fullMatch[1];
    const known = [SAMPLE_CONTRACT, '0xabcdef1234567890abcdef1234567890abcdef12'].map((a) => a.toLowerCase());
    if (!known.includes(addr.toLowerCase())) {
      res.writeHead(404);
      res.end();
      return;
    }
    return send(200, mockFullMetadata(addr));
  }

  if (method === 'GET' && path === '/v1/submissions') {
    const contractAddr = (parsed.query?.contractAddress as string) || '';
    let results = mockSubmissions;
    if (contractAddr && /^0x[a-fA-F0-9]{40}$/.test(contractAddr)) {
      const want = contractAddr.toLowerCase();
      results = mockSubmissions.filter((s) => s.contractAddress.toLowerCase() === want);
    }
    return send(200, results);
  }

  if (method === 'POST' && path === '/v1/submissions/prepare') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const { metadata } = JSON.parse(body || '{}');
        if (!metadata?.abi) return sendError(400, 'Missing metadata.abi');
        send(200, { cid: SAMPLE_CID, checksum: SAMPLE_CHECKSUM });
      } catch {
        sendError(400, 'Invalid JSON');
      }
    });
    return;
  }

  if (method === 'POST' && path === '/v1/submissions/finalize') {
    return send(200, { submissionId: 'sub-new-123', message: 'Submission received' });
  }

  if (method === 'POST' && path === '/v1/assets/logo') {
    return send(200, { url: 'https://example.com/logo.png' });
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Mock API listening on http://localhost:${PORT}`);
});
