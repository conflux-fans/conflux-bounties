import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rulesJson = process.env.DEFAULT_RULES_JSON;
  if (!rulesJson) {
    console.log('No DEFAULT_RULES_JSON set, skipping seed.');
    return;
  }

  const rules = JSON.parse(rulesJson) as Array<{
    name: string;
    contractAddress: string;
    contractType: string;
    minBalance?: string;
    chainId: number;
    tokenId?: string;
    logic?: string;
  }>;

  for (const rule of rules) {
    await prisma.gatingRule.create({
      data: {
        name: rule.name,
        contractAddress: rule.contractAddress,
        contractType: rule.contractType,
        minBalance: rule.minBalance ?? '1',
        chainId: rule.chainId,
        tokenId: rule.tokenId ?? null,
        logic: rule.logic ?? 'ALL',
      },
    });
    console.log(`Created rule: ${rule.name}`);
  }

  console.log('Seed complete.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
