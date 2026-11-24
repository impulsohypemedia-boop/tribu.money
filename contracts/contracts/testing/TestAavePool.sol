// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Test-only stand-in for Aave v3's Pool: the same income index and the same half-up rounding of
// scaled balances, with an index the test can raise to simulate interest.
contract TestAavePool {
    uint256 private constant RAY = 1e27;

    mapping(address => uint256) public index;
    mapping(address => mapping(address => uint256)) public scaledBalanceOf;
    bool public paused;

    function list(address asset) external {
        index[asset] = RAY;
    }

    /// The test also mints the interest to this contract, as borrowers would have paid it.
    function setIndex(address asset, uint256 newIndex) external {
        index[asset] = newIndex;
    }

    /// Simulates every supplied dollar being lent out at once.
    function setPaused(bool value) external {
        paused = value;
    }

    function getReserveNormalizedIncome(address asset) external view returns (uint256) {
        return index[asset];
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16) external {
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        scaledBalanceOf[asset][onBehalfOf] += _rayDivHalfUp(amount, index[asset]);
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        require(!paused, "no liquidity");
        scaledBalanceOf[asset][msg.sender] -= _rayDivHalfUp(amount, index[asset]);
        IERC20(asset).transfer(to, amount);
        return amount;
    }

    function balanceOf(address asset, address account) external view returns (uint256) {
        return (scaledBalanceOf[asset][account] * index[asset] + RAY / 2) / RAY;
    }

    function _rayDivHalfUp(uint256 a, uint256 b) private pure returns (uint256) {
        return (a * RAY + b / 2) / b;
    }
}
