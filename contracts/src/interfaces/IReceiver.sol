// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IReceiver - receives CRE keystone reports
/// @dev Mirrors the Chainlink keystone IReceiver interface for Solidity 0.8.28 compat.
interface IReceiver {
    /// @notice Handles incoming keystone reports.
    /// @param metadata Report metadata (workflow ID, DON config, signatures).
    /// @param report   ABI-encoded workflow report payload.
    function onReport(bytes calldata metadata, bytes calldata report) external;
}
