// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library PythStructs {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
        uint64 emaPrice;
        uint64 emaConf;
    }
}
