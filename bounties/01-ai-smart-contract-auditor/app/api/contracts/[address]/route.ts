import { NextRequest, NextResponse } from 'next/server';
import { getContractSource, ContractNotFound } from '../../../lib/confluxScanClient';

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  const { address } = params;

  if (!ADDRESS_REGEX.test(address)) {
    return NextResponse.json(
      { error: 'Invalid address format' },
      { status: 400 }
    );
  }

  try {
    const source = await getContractSource(address);
    return NextResponse.json({ source });
  } catch (error) {
    if (error instanceof ContractNotFound) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}