import {
  PYTH_CONTRACT_ADDRESS,
  PYTH_ABI,
  PRICE_CONSUMER_ADDRESS,
  PRICE_CONSUMER_ABI,
  BETTING_CONTRACT_ADDRESS,
  BETTING_ABI,
  LENDING_CONTRACT_ADDRESS,
  LENDING_ABI,
  FEE_MANAGER_ADDRESS,
  FEE_MANAGER_ABI,
  FALLBACK_ORACLE_ADDRESS,
  FALLBACK_ORACLE_ABI,
} from '../lib/contractABI';

describe('Contract ABI Configuration', () => {
  describe('Contract Addresses', () => {
    test('PYTH_CONTRACT_ADDRESS is defined', () => {
      expect(PYTH_CONTRACT_ADDRESS).toBeDefined();
      expect(typeof PYTH_CONTRACT_ADDRESS).toBe('string');
    });

    test('PYTH_CONTRACT_ADDRESS is valid ethereum address', () => {
      expect(PYTH_CONTRACT_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    test('PRICE_CONSUMER_ADDRESS is defined', () => {
      expect(PRICE_CONSUMER_ADDRESS).toBeDefined();
      expect(typeof PRICE_CONSUMER_ADDRESS).toBe('string');
    });

    test('PRICE_CONSUMER_ADDRESS is valid ethereum address', () => {
      expect(PRICE_CONSUMER_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    test('BETTING_CONTRACT_ADDRESS is defined', () => {
      expect(BETTING_CONTRACT_ADDRESS).toBeDefined();
      expect(typeof BETTING_CONTRACT_ADDRESS).toBe('string');
    });

    test('BETTING_CONTRACT_ADDRESS is valid ethereum address', () => {
      expect(BETTING_CONTRACT_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    test('LENDING_CONTRACT_ADDRESS is defined', () => {
      expect(LENDING_CONTRACT_ADDRESS).toBeDefined();
      expect(typeof LENDING_CONTRACT_ADDRESS).toBe('string');
    });

    test('LENDING_CONTRACT_ADDRESS is valid ethereum address', () => {
      expect(LENDING_CONTRACT_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    test('FEE_MANAGER_ADDRESS is defined', () => {
      expect(FEE_MANAGER_ADDRESS).toBeDefined();
      expect(typeof FEE_MANAGER_ADDRESS).toBe('string');
    });

    test('FEE_MANAGER_ADDRESS is valid ethereum address', () => {
      expect(FEE_MANAGER_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    test('FALLBACK_ORACLE_ADDRESS is defined', () => {
      expect(FALLBACK_ORACLE_ADDRESS).toBeDefined();
      expect(typeof FALLBACK_ORACLE_ADDRESS).toBe('string');
    });

    test('FALLBACK_ORACLE_ADDRESS is valid ethereum address', () => {
      expect(FALLBACK_ORACLE_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    test('all addresses are unique', () => {
      const addresses = [
        PYTH_CONTRACT_ADDRESS,
        PRICE_CONSUMER_ADDRESS,
        BETTING_CONTRACT_ADDRESS,
        LENDING_CONTRACT_ADDRESS,
        FEE_MANAGER_ADDRESS,
        FALLBACK_ORACLE_ADDRESS,
      ];
      
      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(addresses.length);
    });

    test('all addresses use checksummed format', () => {
      const addresses = [
        PYTH_CONTRACT_ADDRESS,
        PRICE_CONSUMER_ADDRESS,
        BETTING_CONTRACT_ADDRESS,
        LENDING_CONTRACT_ADDRESS,
        FEE_MANAGER_ADDRESS,
        FALLBACK_ORACLE_ADDRESS,
      ];
      
      addresses.forEach(address => {
        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });
    });
  });

  describe('PYTH_ABI', () => {
    test('is defined as array', () => {
      expect(Array.isArray(PYTH_ABI)).toBe(true);
    });

    test('has correct number of functions', () => {
      expect(PYTH_ABI.length).toBe(3);
    });

    test('contains updatePriceFeeds function', () => {
      const updateFunc = PYTH_ABI.find((item: any) => item.name === 'updatePriceFeeds');
      expect(updateFunc).toBeDefined();
      expect(updateFunc?.type).toBe('function');
      expect(updateFunc?.stateMutability).toBe('payable');
    });

    test('updatePriceFeeds has correct inputs', () => {
      const updateFunc = PYTH_ABI.find((item: any) => item.name === 'updatePriceFeeds');
      expect(updateFunc?.inputs).toHaveLength(1);
      expect(updateFunc?.inputs[0].type).toBe('bytes[]');
      expect(updateFunc?.inputs[0].name).toBe('updateData');
    });

    test('contains getPrice function', () => {
      const getPrice = PYTH_ABI.find((item: any) => item.name === 'getPrice');
      expect(getPrice).toBeDefined();
      expect(getPrice?.type).toBe('function');
      expect(getPrice?.stateMutability).toBe('view');
    });

    test('getPrice has correct input structure', () => {
      const getPrice = PYTH_ABI.find((item: any) => item.name === 'getPrice');
      expect(getPrice?.inputs).toHaveLength(1);
      expect(getPrice?.inputs[0].type).toBe('bytes32');
      expect(getPrice?.inputs[0].name).toBe('id');
    });

    test('getPrice returns Price struct', () => {
      const getPrice = PYTH_ABI.find((item: any) => item.name === 'getPrice');
      expect(getPrice?.outputs).toHaveLength(1);
      expect(getPrice?.outputs[0].type).toBe('tuple');
      expect(getPrice?.outputs[0].components).toHaveLength(4);
    });

    test('Price struct has correct fields', () => {
      const getPrice = PYTH_ABI.find((item: any) => item.name === 'getPrice');
      const components = getPrice?.outputs[0].components;
      
      expect(components[0].name).toBe('price');
      expect(components[0].type).toBe('int64');
      expect(components[1].name).toBe('conf');
      expect(components[1].type).toBe('uint64');
      expect(components[2].name).toBe('expo');
      expect(components[2].type).toBe('int32');
      expect(components[3].name).toBe('publishTime');
      expect(components[3].type).toBe('uint256');
    });

    test('contains getPriceUnsafe function', () => {
      const getPriceUnsafe = PYTH_ABI.find((item: any) => item.name === 'getPriceUnsafe');
      expect(getPriceUnsafe).toBeDefined();
      expect(getPriceUnsafe?.stateMutability).toBe('view');
    });

    test('all functions have valid type', () => {
      PYTH_ABI.forEach((item: any) => {
        expect(item.type).toBe('function');
      });
    });
  });

  describe('PRICE_CONSUMER_ABI', () => {
    test('is defined as array', () => {
      expect(Array.isArray(PRICE_CONSUMER_ABI)).toBe(true);
    });

    test('contains constructor', () => {
      const constructor = PRICE_CONSUMER_ABI.find((item: any) => item.type === 'constructor');
      expect(constructor).toBeDefined();
      expect(constructor?.stateMutability).toBe('nonpayable');
    });

    test('constructor has pyth address parameter', () => {
      const constructor = PRICE_CONSUMER_ABI.find((item: any) => item.type === 'constructor');
      expect(constructor?.inputs).toHaveLength(1);
      expect(constructor?.inputs[0].name).toBe('_pyth');
      expect(constructor?.inputs[0].type).toBe('address');
    });

    test('contains getLatestPrice function', () => {
      const getLatestPrice = PRICE_CONSUMER_ABI.find((item: any) => item.name === 'getLatestPrice');
      expect(getLatestPrice).toBeDefined();
      expect(getLatestPrice?.type).toBe('function');
      expect(getLatestPrice?.stateMutability).toBe('view');
    });

    test('getLatestPrice has correct signature', () => {
      const getLatestPrice = PRICE_CONSUMER_ABI.find((item: any) => item.name === 'getLatestPrice');
      expect(getLatestPrice?.inputs).toHaveLength(1);
      expect(getLatestPrice?.inputs[0].type).toBe('bytes32');
      expect(getLatestPrice?.outputs).toHaveLength(1);
      expect(getLatestPrice?.outputs[0].type).toBe('int64');
    });
  });

  describe('BETTING_ABI', () => {
    test('is defined as array', () => {
      expect(Array.isArray(BETTING_ABI)).toBe(true);
    });

    test('has correct number of items', () => {
      expect(BETTING_ABI.length).toBeGreaterThan(10);
    });

    test('contains constructor', () => {
      const constructor = BETTING_ABI.find((item: any) => item.type === 'constructor');
      expect(constructor).toBeDefined();
    });

    test('contains view functions', () => {
      const viewFunctions = BETTING_ABI.filter((item: any) => 
        item.type === 'function' && item.stateMutability === 'view'
      );
      expect(viewFunctions.length).toBeGreaterThan(0);
    });

    test('contains placeBet function', () => {
      const placeBet = BETTING_ABI.find((item: any) => item.name === 'placeBet');
      expect(placeBet).toBeDefined();
      expect(placeBet?.stateMutability).toBe('payable');
    });

    test('placeBet has correct parameters', () => {
      const placeBet = BETTING_ABI.find((item: any) => item.name === 'placeBet');
      expect(placeBet?.inputs).toHaveLength(4);
      expect(placeBet?.inputs[0].name).toBe('priceId');
      expect(placeBet?.inputs[1].name).toBe('targetPrice');
      expect(placeBet?.inputs[2].name).toBe('predictAbove');
      expect(placeBet?.inputs[3].name).toBe('duration');
    });

    test('contains settleBet function', () => {
      const settleBet = BETTING_ABI.find((item: any) => item.name === 'settleBet');
      expect(settleBet).toBeDefined();
      expect(settleBet?.stateMutability).toBe('nonpayable');
    });

    test('contains getUserBets function', () => {
      const getUserBets = BETTING_ABI.find((item: any) => item.name === 'getUserBets');
      expect(getUserBets).toBeDefined();
      expect(getUserBets?.outputs[0].type).toBe('uint256[]');
    });

    test('contains getBet function with tuple return', () => {
      const getBet = BETTING_ABI.find((item: any) => item.name === 'getBet');
      expect(getBet).toBeDefined();
      expect(getBet?.outputs[0].type).toBe('tuple');
      expect(getBet?.outputs[0].components).toHaveLength(8);
    });

    test('contains BetPlaced event', () => {
      const event = BETTING_ABI.find((item: any) => item.name === 'BetPlaced');
      expect(event).toBeDefined();
      expect(event?.type).toBe('event');
      expect(event?.anonymous).toBe(false);
    });

    test('BetPlaced event has indexed parameters', () => {
      const event = BETTING_ABI.find((item: any) => item.name === 'BetPlaced');
      const indexedParams = event?.inputs.filter((input: any) => input.indexed);
      expect(indexedParams.length).toBeGreaterThan(0);
    });

    test('contains BetSettled event', () => {
      const event = BETTING_ABI.find((item: any) => item.name === 'BetSettled');
      expect(event).toBeDefined();
      expect(event?.type).toBe('event');
    });

    test('contains FeesWithdrawn event', () => {
      const event = BETTING_ABI.find((item: any) => item.name === 'FeesWithdrawn');
      expect(event).toBeDefined();
    });
  });

  describe('LENDING_ABI', () => {
    test('is defined as array', () => {
      expect(Array.isArray(LENDING_ABI)).toBe(true);
    });

    test('contains constructor', () => {
      const constructor = LENDING_ABI.find((item: any) => item.type === 'constructor');
      expect(constructor).toBeDefined();
    });

    test('contains openPosition function', () => {
      const openPosition = LENDING_ABI.find((item: any) => item.name === 'openPosition');
      expect(openPosition).toBeDefined();
      expect(openPosition?.stateMutability).toBe('payable');
    });

    test('openPosition has correct parameters', () => {
      const openPosition = LENDING_ABI.find((item: any) => item.name === 'openPosition');
      expect(openPosition?.inputs).toHaveLength(3);
      expect(openPosition?.inputs[0].name).toBe('collateralAsset');
      expect(openPosition?.inputs[1].name).toBe('borrowAsset');
      expect(openPosition?.inputs[2].name).toBe('borrowAmount');
    });

    test('contains getHealthRatio function', () => {
      const getHealthRatio = LENDING_ABI.find((item: any) => item.name === 'getHealthRatio');
      expect(getHealthRatio).toBeDefined();
      expect(getHealthRatio?.stateMutability).toBe('view');
    });

    test('contains liquidate function', () => {
      const liquidate = LENDING_ABI.find((item: any) => item.name === 'liquidate');
      expect(liquidate).toBeDefined();
      expect(liquidate?.stateMutability).toBe('nonpayable');
    });

    test('contains repayPosition function', () => {
      const repayPosition = LENDING_ABI.find((item: any) => item.name === 'repayPosition');
      expect(repayPosition).toBeDefined();
      expect(repayPosition?.stateMutability).toBe('payable');
    });

    test('contains getUserPositions function', () => {
      const getUserPositions = LENDING_ABI.find((item: any) => item.name === 'getUserPositions');
      expect(getUserPositions).toBeDefined();
      expect(getUserPositions?.outputs[0].type).toBe('uint256[]');
    });

    test('contains getPositionDetails function with complex return', () => {
      const getPositionDetails = LENDING_ABI.find((item: any) => item.name === 'getPositionDetails');
      expect(getPositionDetails).toBeDefined();
      expect(getPositionDetails?.outputs).toHaveLength(4);
      expect(getPositionDetails?.outputs[0].type).toBe('tuple');
    });

    test('contains constant values', () => {
      const threshold = LENDING_ABI.find((item: any) => item.name === 'LIQUIDATION_THRESHOLD');
      const bonus = LENDING_ABI.find((item: any) => item.name === 'LIQUIDATION_BONUS');
      
      expect(threshold).toBeDefined();
      expect(bonus).toBeDefined();
    });

    test('contains PositionOpened event', () => {
      const event = LENDING_ABI.find((item: any) => item.name === 'PositionOpened');
      expect(event).toBeDefined();
      expect(event?.type).toBe('event');
    });

    test('contains PositionRepaid event', () => {
      const event = LENDING_ABI.find((item: any) => item.name === 'PositionRepaid');
      expect(event).toBeDefined();
    });

    test('contains PositionLiquidated event', () => {
      const event = LENDING_ABI.find((item: any) => item.name === 'PositionLiquidated');
      expect(event).toBeDefined();
    });

    test('contains receive function', () => {
      const receive = LENDING_ABI.find((item: any) => item.type === 'receive');
      expect(receive).toBeDefined();
      expect(receive?.stateMutability).toBe('payable');
    });
  });

  describe('FEE_MANAGER_ABI', () => {
    test('is defined as array', () => {
      expect(Array.isArray(FEE_MANAGER_ABI)).toBe(true);
    });

    test('contains constructor', () => {
      const constructor = FEE_MANAGER_ABI.find((item: any) => item.type === 'constructor');
      expect(constructor).toBeDefined();
      expect(constructor?.inputs[0].name).toBe('_platformFee');
    });

    test('contains platformFee view function', () => {
      const platformFee = FEE_MANAGER_ABI.find((item: any) => item.name === 'platformFee');
      expect(platformFee).toBeDefined();
      expect(platformFee?.stateMutability).toBe('view');
    });

    test('contains calculateFee function', () => {
      const calculateFee = FEE_MANAGER_ABI.find((item: any) => item.name === 'calculateFee');
      expect(calculateFee).toBeDefined();
      expect(calculateFee?.inputs).toHaveLength(1);
      expect(calculateFee?.outputs).toHaveLength(1);
    });

    test('contains updateFee function', () => {
      const updateFee = FEE_MANAGER_ABI.find((item: any) => item.name === 'updateFee');
      expect(updateFee).toBeDefined();
      expect(updateFee?.stateMutability).toBe('nonpayable');
    });

    test('contains withdrawFees function', () => {
      const withdrawFees = FEE_MANAGER_ABI.find((item: any) => item.name === 'withdrawFees');
      expect(withdrawFees).toBeDefined();
    });
  });

  describe('FALLBACK_ORACLE_ABI', () => {
    test('is defined as array', () => {
      expect(Array.isArray(FALLBACK_ORACLE_ABI)).toBe(true);
    });

    test('contains constructor with two oracle addresses', () => {
      const constructor = FALLBACK_ORACLE_ABI.find((item: any) => item.type === 'constructor');
      expect(constructor).toBeDefined();
      expect(constructor?.inputs).toHaveLength(2);
      expect(constructor?.inputs[0].name).toBe('_primaryOracle');
      expect(constructor?.inputs[1].name).toBe('_backupOracle');
    });

    test('contains getPrice function', () => {
      const getPrice = FALLBACK_ORACLE_ABI.find((item: any) => item.name === 'getPrice');
      expect(getPrice).toBeDefined();
      expect(getPrice?.stateMutability).toBe('view');
    });

    test('getPrice returns multiple values', () => {
      const getPrice = FALLBACK_ORACLE_ABI.find((item: any) => item.name === 'getPrice');
      expect(getPrice?.outputs).toHaveLength(2);
      expect(getPrice?.outputs[0].name).toBe('price');
      expect(getPrice?.outputs[1].name).toBe('timestamp');
    });

    test('contains isPrimaryActive function', () => {
      const isPrimaryActive = FALLBACK_ORACLE_ABI.find((item: any) => item.name === 'isPrimaryActive');
      expect(isPrimaryActive).toBeDefined();
      expect(isPrimaryActive?.outputs[0].type).toBe('bool');
    });

    test('contains switchToBackup function', () => {
      const switchToBackup = FALLBACK_ORACLE_ABI.find((item: any) => item.name === 'switchToBackup');
      expect(switchToBackup).toBeDefined();
    });
  });

  describe('ABI Validation', () => {
    test('all ABIs are readonly arrays', () => {
      const abis = [
        PYTH_ABI,
        PRICE_CONSUMER_ABI,
        BETTING_ABI,
        LENDING_ABI,
        FEE_MANAGER_ABI,
        FALLBACK_ORACLE_ABI,
      ];
      
      abis.forEach(abi => {
        expect(Array.isArray(abi)).toBe(true);
        expect(abi.length).toBeGreaterThan(0);
      });
    });

    test('all function ABIs have required fields', () => {
      const allAbis = [
        ...PYTH_ABI,
        ...PRICE_CONSUMER_ABI,
        ...BETTING_ABI,
        ...LENDING_ABI,
        ...FEE_MANAGER_ABI,
        ...FALLBACK_ORACLE_ABI,
      ];
      
      const functions = allAbis.filter((item: any) => item.type === 'function');
      
      functions.forEach((func: any) => {
        expect(func).toHaveProperty('name');
        expect(func).toHaveProperty('type');
        expect(func).toHaveProperty('stateMutability');
        expect(func).toHaveProperty('inputs');
        expect(func).toHaveProperty('outputs');
      });
    });

    test('all event ABIs have required fields', () => {
      const allAbis = [
        ...BETTING_ABI,
        ...LENDING_ABI,
      ];
      
      const events = allAbis.filter((item: any) => item.type === 'event');
      
      events.forEach((event: any) => {
        expect(event).toHaveProperty('name');
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('inputs');
        expect(event).toHaveProperty('anonymous');
      });
    });

    test('no duplicate function names within same ABI', () => {
      const checkDuplicates = (abi: any[], name: string) => {
        const functions = abi.filter((item: any) => item.type === 'function');
        const names = functions.map((func: any) => func.name);
        const uniqueNames = new Set(names);
        expect(uniqueNames.size).toBe(names.length);
      };

      checkDuplicates(PYTH_ABI, 'PYTH_ABI');
      checkDuplicates(BETTING_ABI, 'BETTING_ABI');
      checkDuplicates(LENDING_ABI, 'LENDING_ABI');
    });
  });

  describe('Type Safety', () => {
    test('ABIs are typed as const', () => {
      expect(() => {
        const test: typeof PYTH_ABI = PYTH_ABI;
      }).not.toThrow();
    });

    test('addresses are string literals', () => {
      expect(typeof PYTH_CONTRACT_ADDRESS).toBe('string');
      expect(typeof BETTING_CONTRACT_ADDRESS).toBe('string');
      expect(typeof LENDING_CONTRACT_ADDRESS).toBe('string');
    });
  });

  describe('Export Validation', () => {
    test('all exports are defined', () => {
      expect(PYTH_CONTRACT_ADDRESS).toBeDefined();
      expect(PYTH_ABI).toBeDefined();
      expect(PRICE_CONSUMER_ADDRESS).toBeDefined();
      expect(PRICE_CONSUMER_ABI).toBeDefined();
      expect(BETTING_CONTRACT_ADDRESS).toBeDefined();
      expect(BETTING_ABI).toBeDefined();
      expect(LENDING_CONTRACT_ADDRESS).toBeDefined();
      expect(LENDING_ABI).toBeDefined();
      expect(FEE_MANAGER_ADDRESS).toBeDefined();
      expect(FEE_MANAGER_ABI).toBeDefined();
      expect(FALLBACK_ORACLE_ADDRESS).toBeDefined();
      expect(FALLBACK_ORACLE_ABI).toBeDefined();
    });

    test('exports are importable', () => {
      const module = require('../lib/contractABI');
      
      expect(module.PYTH_CONTRACT_ADDRESS).toBe(PYTH_CONTRACT_ADDRESS);
      expect(module.BETTING_ABI).toBe(BETTING_ABI);
      expect(module.LENDING_ABI).toBe(LENDING_ABI);
    });
  });
});