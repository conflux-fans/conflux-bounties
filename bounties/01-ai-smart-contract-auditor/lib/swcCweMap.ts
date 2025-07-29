
export const swcToDescription: Record<string, string> = {
  'SWC-100': 'Function Default Visibility - Functions that do not have a function visibility type specified are public by default',
  'SWC-101': 'Integer Overflow and Underflow - An overflow/underflow happens when an arithmetic operation reaches the maximum or minimum size of a type',
  'SWC-102': 'Outdated Compiler Version - Using an outdated compiler version can be problematic especially if there are publicly disclosed bugs and issues',
  'SWC-103': 'Floating Pragma - Contracts should be deployed with the same compiler version and flags that they have been tested with thoroughly',
  'SWC-104': 'Unchecked Call Return Value - The return value of a message call is not checked',
  'SWC-105': 'Unprotected Ether Withdrawal - Due to missing or inadequate access controls, malicious parties can withdraw some or all Ether from the contract account',
  'SWC-106': 'Unprotected SELFDESTRUCT Instruction - Due to missing or inadequate access controls, malicious parties can self-destruct the contract',
  'SWC-107': 'Reentrancy - One of the major dangers of calling external contracts is that they can take over the control flow',
  'SWC-108': 'State Variable Default Visibility - Variables can be specified as being public, internal or private',
  'SWC-109': 'Uninitialized Storage Pointer - Local variables within functions default to storage or memory depending on their type',
  'SWC-110': 'Assert Violation - The Solidity assert() function is meant to assert invariants. Properly functioning code should never reach a failing assert statement',
  'SWC-111': 'Use of Deprecated Solidity Functions - Several functions and operators in Solidity are deprecated',
  'SWC-112': 'Delegatecall to Untrusted Callee - There exists a special variant of a message call, named delegatecall which is identical to a message call apart from the fact that the code at the target address is executed in the context of the calling contract',
  'SWC-113': 'DoS with Failed Call - External calls can fail accidentally or deliberately, which can cause a DoS condition in the contract',
  'SWC-114': 'Transaction Order Dependence - Race conditions can be forced on specific Ethereum transactions by monitoring the mempool',
  'SWC-115': 'Authorization through tx.origin - tx.origin is a global variable in Solidity which returns the address of the account that sent the transaction',
  'SWC-116': 'Block values as a proxy for time - Contracts often need access to time values to perform certain types of functionality',
  'SWC-117': 'Signature Malleability - The implementation of a cryptographic signature system in Ethereum contracts often assumes that the signature is unique',
  'SWC-118': 'Incorrect Constructor Name - Constructors are special functions that are called only once during the contract creation',
  'SWC-119': 'Shadowing State Variables - Solidity allows for ambiguous naming of state variables when inheritance is used',
  'SWC-120': 'Weak Sources of Randomness from Chain Attributes - Ability to generate random numbers is very helpful in all kinds of applications',
  'SWC-121': 'Missing Protection against Signature Replay Attacks - It is sometimes necessary to perform signature verification in smart contracts to achieve better usability or to save gas cost',
  'SWC-122': 'Lack of Proper Signature Verification - It is a common pattern for smart contract systems to allow users to sign messages off-chain instead of directly requesting users to do an on-chain transaction',
  'SWC-123': 'Requirement Violation - The Solidity require() construct is meant to validate external inputs of a function',
  'SWC-124': 'Write to Arbitrary Storage Location - A smart contract\'s data (e.g., storing the owner of the contract) is persistently stored at storage slots on the Ethereum mainnet',
  'SWC-125': 'Incorrect Inheritance Order - Solidity supports multiple inheritance, meaning that one contract can inherit several contracts',
  'SWC-126': 'Insufficient Gas Griefing - Insufficient gas griefing attacks can be performed on contracts which accept data and use it in a sub-call on another contract',
  'SWC-127': 'Arbitrary Jump with Function Type Variable - Solidity supports function types. That is, a variable of function type can be assigned with a reference to a function with a matching signature',
  'SWC-128': 'DoS With Block Gas Limit - When smart contracts are deployed or functions inside them are called, the execution of these actions always requires a certain amount of gas',
  'SWC-129': 'Typographical Error - A typographical error can occur for example when the intent of a defined operation is the opposite of what is to be executed',
  'SWC-130': 'Right-To-Left-Override control character (U+202E) - Malicious actors can use the Right-To-Left-Override unicode character to force RTL text rendering and confuse users as to the real intent of a contract',
  'SWC-131': 'Presence of unused variables - Unused variables are allowed in Solidity and they do not pose a direct security issue',
  'SWC-132': 'Unexpected Ether balance - Contracts can behave erroneously when they strictly assume a specific Ether balance',
  'SWC-133': 'Hash Collisions With Multiple Variable Length Arguments - Using abi.encodePacked() with multiple variable length arguments can, in certain circumstances, lead to a hash collision',
  'SWC-134': 'Message call with hardcoded gas amount - The transfer() and send() functions forward a fixed amount of 2300 gas',
  'SWC-135': 'Code With No Effects - In some cases, the Solidity compiler optimizes out code which cannot affect the outcome of a function',
  'SWC-136': 'Unencrypted Private Data On-Chain - It is a common misconception that private type variables cannot be read'
};

export const cweToLink: Record<string, string> = {
  'CWE-20': 'https://cwe.mitre.org/data/definitions/20.html',
  'CWE-22': 'https://cwe.mitre.org/data/definitions/22.html',
  'CWE-78': 'https://cwe.mitre.org/data/definitions/78.html',
  'CWE-79': 'https://cwe.mitre.org/data/definitions/79.html',
  'CWE-89': 'https://cwe.mitre.org/data/definitions/89.html',
  'CWE-94': 'https://cwe.mitre.org/data/definitions/94.html',
  'CWE-119': 'https://cwe.mitre.org/data/definitions/119.html',
  'CWE-120': 'https://cwe.mitre.org/data/definitions/120.html',
  'CWE-125': 'https://cwe.mitre.org/data/definitions/125.html',
  'CWE-129': 'https://cwe.mitre.org/data/definitions/129.html',
  'CWE-134': 'https://cwe.mitre.org/data/definitions/134.html',
  'CWE-190': 'https://cwe.mitre.org/data/definitions/190.html',   // Integer Overflow or Wraparound
  'CWE-191': 'https://cwe.mitre.org/data/definitions/191.html',   // Integer Underflow
  'CWE-200': 'https://cwe.mitre.org/data/definitions/200.html',   // Exposure of Sensitive Information to an Unauthorized Actor
  'CWE-209': 'https://cwe.mitre.org/data/definitions/209.html',   // Generation of Error Message Containing Sensitive Information
  'CWE-250': 'https://cwe.mitre.org/data/definitions/250.html',   // Execution with Unnecessary Privileges
  'CWE-269': 'https://cwe.mitre.org/data/definitions/269.html',   // Improper Privilege Management
  'CWE-284': 'https://cwe.mitre.org/data/definitions/284.html',   // Improper Access Control
  'CWE-285': 'https://cwe.mitre.org/data/definitions/285.html',   // Improper Authorization
  'CWE-287': 'https://cwe.mitre.org/data/definitions/287.html',   // Improper Authentication
  'CWE-290': 'https://cwe.mitre.org/data/definitions/290.html',   // Authentication Bypass by Spoofing
  'CWE-295': 'https://cwe.mitre.org/data/definitions/295.html',   // Improper Certificate Validation
  'CWE-297': 'https://cwe.mitre.org/data/definitions/297.html',   // Improper Validation of Certificate with Host Mismatch
  'CWE-300': 'https://cwe.mitre.org/data/definitions/300.html',   // Channel Accessible by Non-Endpoint
  'CWE-306': 'https://cwe.mitre.org/data/definitions/306.html',   // Missing Authentication for Critical Function
  'CWE-307': 'https://cwe.mitre.org/data/definitions/307.html',   // Improper Restriction of Excessive Authentication Attempts
  'CWE-311': 'https://cwe.mitre.org/data/definitions/311.html',   // Missing Encryption of Sensitive Data
  'CWE-312': 'https://cwe.mitre.org/data/definitions/312.html',   // Cleartext Storage of Sensitive Information
  'CWE-319': 'https://cwe.mitre.org/data/definitions/319.html',   // Cleartext Transmission of Sensitive Information
  'CWE-326': 'https://cwe.mitre.org/data/definitions/326.html',   // Inadequate Encryption Strength
  'CWE-327': 'https://cwe.mitre.org/data/definitions/327.html',   // Use of a Broken or Risky Cryptographic Algorithm
  'CWE-330': 'https://cwe.mitre.org/data/definitions/330.html',   // Use of Insufficiently Random Values
  'CWE-345': 'https://cwe.mitre.org/data/definitions/345.html',   // Insufficient Verification of Data Authenticity
  'CWE-346': 'https://cwe.mitre.org/data/definitions/346.html',   // Origin Validation Error
  'CWE-352': 'https://cwe.mitre.org/data/definitions/352.html',   // Cross-Site Request Forgery (CSRF)
  'CWE-362': 'https://cwe.mitre.org/data/definitions/362.html',   // Concurrent Execution using Shared Resource with Improper Synchronization
  'CWE-367': 'https://cwe.mitre.org/data/definitions/367.html',   // Time-of-check Time-of-use (TOCTOU) Race Condition
  'CWE-369': 'https://cwe.mitre.org/data/definitions/369.html',   // Divide By Zero
  'CWE-377': 'https://cwe.mitre.org/data/definitions/377.html',   // Insecure Temporary File
  'CWE-400': 'https://cwe.mitre.org/data/definitions/400.html',   // Uncontrolled Resource Consumption
  'CWE-401': 'https://cwe.mitre.org/data/definitions/401.html',   // Missing Release of Memory after Effective Lifetime
  'CWE-434': 'https://cwe.mitre.org/data/definitions/434.html',   // Unrestricted Upload of File with Dangerous Type
  'CWE-476': 'https://cwe.mitre.org/data/definitions/476.html',   // NULL Pointer Dereference
  'CWE-502': 'https://cwe.mitre.org/data/definitions/502.html',   // Deserialization of Untrusted Data
  'CWE-522': 'https://cwe.mitre.org/data/definitions/522.html',   // Insufficiently Protected Credentials
  'CWE-532': 'https://cwe.mitre.org/data/definitions/532.html',   // Insertion of Sensitive Information into Log File
  'CWE-601': 'https://cwe.mitre.org/data/definitions/601.html',   // URL Redirection to Untrusted Site
  'CWE-611': 'https://cwe.mitre.org/data/definitions/611.html',   // Improper Restriction of XML External Entity Reference
  'CWE-639': 'https://cwe.mitre.org/data/definitions/639.html',   // Authorization Bypass Through User-Controlled Key
  'CWE-662': 'https://cwe.mitre.org/data/definitions/662.html',   // Improper Synchronization
  'CWE-667': 'https://cwe.mitre.org/data/definitions/667.html',   // Improper Locking
  'CWE-682': 'https://cwe.mitre.org/data/definitions/682.html',   // Incorrect Calculation
  'CWE-697': 'https://cwe.mitre.org/data/definitions/697.html',   // Incorrect Comparison
  'CWE-703': 'https://cwe.mitre.org/data/definitions/703.html',   // Improper Check or Handling of Exceptional Conditions
  'CWE-706': 'https://cwe.mitre.org/data/definitions/706.html',   // Use of Incorrectly-Resolved Name or Reference
  'CWE-732': 'https://cwe.mitre.org/data/definitions/732.html',   // Incorrect Permission Assignment for Critical Resource
  'CWE-754': 'https://cwe.mitre.org/data/definitions/754.html',   // Improper Check for Unusual or Exceptional Conditions
  'CWE-787': 'https://cwe.mitre.org/data/definitions/787.html',   // Out-of-bounds Write
  'CWE-798': 'https://cwe.mitre.org/data/definitions/798.html',   // Use of Hard-coded Credentials
  'CWE-807': 'https://cwe.mitre.org/data/definitions/807.html',   // Reliance on Untrusted Inputs in a Security Decision
  'CWE-829': 'https://cwe.mitre.org/data/definitions/829.html',   // Inclusion of Functionality from Untrusted Control Sphere
  'CWE-834': 'https://cwe.mitre.org/data/definitions/834.html',   // Excessive Iteration
  'CWE-835': 'https://cwe.mitre.org/data/definitions/835.html',   // Loop with Unreachable Exit Condition
  'CWE-841': 'https://cwe.mitre.org/data/definitions/841.html',   // Improper Enforcement of Behavioral Workflow
  'CWE-862': 'https://cwe.mitre.org/data/definitions/862.html',   // Missing Authorization
  'CWE-863': 'https://cwe.mitre.org/data/definitions/863.html',   // Incorrect Authorization
  'CWE-918': 'https://cwe.mitre.org/data/definitions/918.html',   // Server-Side Request Forgery (SSRF)
  'CWE-943': 'https://cwe.mitre.org/data/definitions/943.html',   // Improper Neutralization of Special Elements in Data Query Logic
  'CWE-1004': 'https://cwe.mitre.org/data/definitions/1004.html', // Sensitive Cookie Without 'HttpOnly' Flag
  'CWE-1021': 'https://cwe.mitre.org/data/definitions/1021.html', // Improper Restriction of Rendered UI Layers or Frames
  'CWE-1275': 'https://cwe.mitre.org/data/definitions/1275.html'  // Sensitive Cookie with Improper SameSite Attribute
};

export const swcToCweMapping: Record<string, string[]> = {
  'SWC-101': ['CWE-190', 'CWE-191'],
  'SWC-104': ['CWE-703'],
  'SWE-105': ['CWE-284', 'CWE-862'],
  'SWC-106': ['CWE-284'],
  'SWC-107': ['CWE-841'],
  'SWC-109': ['CWE-665'],
  'SWC-112': ['CWE-829'],
  'SWC-113': ['CWE-400'],
  'SWC-114': ['CWE-362'],
  'SWC-115': ['CWE-290'],
  'SWC-116': ['CWE-829'],
  'SWC-120': ['CWE-330'],
  'SWC-124': ['CWE-123'],
  'SWC-128': ['CWE-400'],
  'SWC-132': ['CWE-682'],
  'SWC-133': ['CWE-693'],
  'SWC-136': ['CWE-200']
};

export function getSWCDescription(swcId: string): string | undefined {
  return swcToDescription[swcId];
}

export function getCWELink(cweId: string): string | undefined {
  return cweToLink[cweId];
}

export function getRelatedCWEs(swcId: string): string[] {
  return swcToCweMapping[swcId] || [];
}