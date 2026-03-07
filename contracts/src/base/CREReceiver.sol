// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IReceiver} from "../interfaces/IReceiver.sol";

/// @title CREReceiver
/// @author Qova Engineering
/// @notice Base contract for receiving CRE workflow reports via KeystoneForwarder.
/// @dev Equivalent to Chainlink's ReceiverTemplate. Validates that only the
///      authorised forwarder can deliver reports.
abstract contract CREReceiver is IReceiver {
    /// @notice The KeystoneForwarder address authorised to deliver reports.
    address public immutable i_forwarder;

    /// @dev Thrown when a caller other than the forwarder invokes onReport.
    error UnauthorizedForwarder();

    constructor(address forwarder) {
        i_forwarder = forwarder;
    }

    /// @notice Validates that msg.sender is the authorised forwarder.
    /// @dev Call this as the first line of every onReport implementation.
    function _validateReport(bytes calldata, bytes calldata) internal view {
        if (msg.sender != i_forwarder) revert UnauthorizedForwarder();
    }
}
