import { NextRequest, NextResponse } from 'next/server';
import { getContractSource, getVerifiedContract, ContractNotFound } from '../../../../lib/confluxScanClient';
import { validateAndNormalizeAddress } from '../../../../lib/addressUtils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  // Validate address using unified validation
  const addressValidation = validateAndNormalizeAddress(address);
  if (!addressValidation.isValid) {
    return NextResponse.json(
      { error: addressValidation.error },
      { status: 400 }
    );
  }

  const normalizedAddress = addressValidation.normalized!;

  try {
    // Get detailed contract information with multi-file support
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';

    if (detailed) {
      const verifiedContract = await getVerifiedContract(normalizedAddress);
      return NextResponse.json({
        address: verifiedContract.address,
        contractName: verifiedContract.contractName,
        sources: verifiedContract.sources,
        compiler: verifiedContract.compiler,
        constructorArguments: verifiedContract.constructorArguments,
        abi: verifiedContract.abi
      });
    } else {
      // Legacy single source response
      const source = await getContractSource(normalizedAddress);
      return NextResponse.json({ 
        address: normalizedAddress,
        source 
      });
    }
  } catch (error) {
    if (error instanceof ContractNotFound) {
      return NextResponse.json(
        { error: 'Contract not found or not verified' },
        { status: 404 }
      );
    }
    console.error('Error fetching contract:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}