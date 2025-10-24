import { ethers } from "hardhat";

async function main() {
  console.log("🎲 Simulating price updates...\n");

  const [signer] = await ethers.getSigners();
  
  // Deploy MockPyth
  const MockPyth = await ethers.getContractFactory("MockPyth");
  const mockPyth = await MockPyth.deploy();
  await mockPyth.waitForDeployment();
  
  const mockPythAddress = await mockPyth.getAddress();
  console.log(`MockPyth deployed at: ${mockPythAddress}\n`);

  // Price feed IDs
  const BTC_ID = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
  const ETH_ID = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
  const CFX_ID = "0x8879170230c9603342f3837cf9a8e76c61791198fb1271bb2552c9af7b33c933";

  // Simulate price updates
  const prices = [
    { id: BTC_ID, symbol: "BTC", basePrice: 50000 },
    { id: ETH_ID, symbol: "ETH", basePrice: 3000 },
    { id: CFX_ID, symbol: "CFX", basePrice: 0.5 },
  ];

  console.log("Setting initial prices...");
  for (const price of prices) {
    const priceValue = BigInt(price.basePrice * 1e8);
    const confidence = BigInt(price.basePrice * 0.001 * 1e8);
    const publishTime = BigInt(Math.floor(Date.now() / 1000));

    await mockPyth.setMockPrice(
      price.id,
      priceValue,
      confidence,
      -8,
      publishTime
    );

    console.log(`✅ ${price.symbol}: $${price.basePrice}`);
  }

  console.log("\n📊 Simulating price volatility for 60 seconds...\n");

  for (let i = 0; i < 12; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));

    for (const price of prices) {
      const variance = (Math.random() - 0.5) * price.basePrice * 0.02;
      const newPrice = price.basePrice + variance;
      const priceValue = BigInt(Math.floor(newPrice * 1e8));
      const confidence = BigInt(Math.floor(newPrice * 0.001 * 1e8));
      const publishTime = BigInt(Math.floor(Date.now() / 1000));

      await mockPyth.setMockPrice(
        price.id,
        priceValue,
        confidence,
        -8,
        publishTime
      );

      console.log(`${price.symbol}: $${newPrice.toFixed(2)}`);
    }
    console.log("---");
  }

  console.log("\n✅ Simulation complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });