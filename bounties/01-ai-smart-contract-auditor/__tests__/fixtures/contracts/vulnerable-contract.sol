// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VulnerableContract {
    mapping(address => uint256) public balances;
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    // Reentrancy vulnerability
    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        balances[msg.sender] -= amount; // State change after external call
    }
    
    // Integer overflow (pre-Solidity 0.8.0 style)
    function deposit() public payable {
        balances[msg.sender] += msg.value; // Could overflow in older versions
    }
    
    // Access control issue
    function emergencyWithdraw() public {
        // Missing onlyOwner modifier
        payable(msg.sender).transfer(address(this).balance);
    }
    
    // Unchecked return value
    function transfer(address to, uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        balances[to] += amount;
        
        // Unchecked external call
        to.call{value: 0}("");
    }
}