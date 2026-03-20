# Sample Smart Contracts for Testing

## Vulnerable ERC20 Token

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VulnerableToken {
    string public name = "VulnerableToken";
    string public symbol = "VTOK";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // SWC-105: Unprotected Self Destruct
    function destroy() public {
        selfdestruct(payable(msg.sender));
    }

    // SWC-107: Reentrancy in withdraw
    function withdraw(uint256 amount) public {
        require(balanceOf[msg.sender] >= amount);
        balanceOf[msg.sender] -= amount; // State update after external call
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success);
    }

    // SWC-104: Unchecked call return value
    function transfer(address to, uint256 amount) public returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        // Missing return value check on potential low-level calls
        return true;
    }

    // SWC-115: Authorization through tx.origin
    function adminTransfer(address to, uint256 amount) public {
        require(tx.origin == owner);
        balanceOf[owner] -= amount;
        balanceOf[to] += amount;
    }

    // SWC-108: Default visibility
    address public owner;

    constructor() {
        owner = msg.sender;
        totalSupply = 1000000 * 10 ** decimals;
        balanceOf[msg.sender] = totalSupply;
    }

    // Gas: inefficient loop with storage read
    function airdrop(address[] calldata recipients, uint256 amount) public {
        for (uint i = 0; i < recipients.length; i++) {
            balanceOf[recipients[i]] += amount; // Missing events
        }
    }

    // SWC-116: Block timestamp usage
    function luckyDraw() public view returns (bool) {
        return block.timestamp % 2 == 0;
    }
}
```

## Secure Reference Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SecureToken is ReentrancyGuard, Ownable {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint8 _decimals, uint256 _supply) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply = _supply;
        balanceOf[msg.sender] = _supply;
        emit Transfer(address(0), msg.sender, _supply);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function withdraw() external nonReentrant onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "Transfer failed");
    }
}
```
