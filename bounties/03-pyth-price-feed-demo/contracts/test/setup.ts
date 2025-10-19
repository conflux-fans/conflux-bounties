import { ethers } from "hardhat";

export async function deployMockPyth() {
  const MockPyth = await ethers.getContractFactory("MockPyth");
  const mockPyth = await MockPyth.deploy();
  await mockPyth.waitForDeployment();
  return mockPyth;
}

export async function setupMockPrices(mockPyth: any) {
  const now = Math.floor(Date.now() / 1000);

  // BTC: $50,000 with expo -8 → raw price = 5000000000000
  await mockPyth.setMockPrice(
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    5000000000000n,
    10000000000n,
    -8,
    now
  );

  // ETH: $3,000 with expo -8 → raw price = 300000000000
  await mockPyth.setMockPrice(
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    300000000000n,
    5000000000n,
    -8,
    now
  );

  // CFX: $0.50 with expo -8 → raw price = 50000000
  await mockPyth.setMockPrice(
    "0x8879170230c9603342f3837cf9a8e76c61791198fb1271bb2552c9af7b33c933",
    50000000n,
    100000n,
    -8,
    now
  );
}

export const PRICE_IDS = {
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  CFX: "0x8879170230c9603342f3837cf9a8e76c61791198fb1271bb2552c9af7b33c933",
};