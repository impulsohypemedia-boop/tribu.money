// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.24;

// Tribu's badges (insignias) as free, non-transferable ERC-1155 tokens on Polygon.
//
// Nobody can mint a badge they did not earn: Tribu's server checks the badge in the room and signs
// a voucher (EIP-712) for that wallet and that badge, and this contract only mints with a valid one.
// Each wallet can hold each badge once. The person minting pays the network fee (or Lemon does,
// if it sponsors it); Tribu pays nothing per mint.
//
// Deploy with the address of the key in TRIBU_BADGE_SIGNER_KEY as `signer`, and an https metadata
// URI ending in {id}.json. Built on OpenZeppelin Contracts 5.x.

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TribuBadges is ERC1155, EIP712, Ownable {
    bytes32 private constant MINT_TYPEHASH = keccak256("Mint(address to,uint256 id)");

    address public signer;

    error AlreadyHasBadge();
    error BadVoucher();
    error Soulbound();

    constructor(address signer_, string memory uri_) ERC1155(uri_) EIP712("TribuBadges", "1") Ownable(msg.sender) {
        signer = signer_;
    }

    function mint(uint256 id, bytes calldata signature) external {
        if (balanceOf(msg.sender, id) > 0) revert AlreadyHasBadge();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(MINT_TYPEHASH, msg.sender, id)));
        if (ECDSA.recover(digest, signature) != signer) revert BadVoucher();
        _mint(msg.sender, id, 1, "");
    }

    function setSigner(address signer_) external onlyOwner {
        signer = signer_;
    }

    function setURI(string calldata uri_) external onlyOwner {
        _setURI(uri_);
    }

    // A badge says what its holder did, so it cannot be passed on.
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
        if (from != address(0) && to != address(0)) revert Soulbound();
        super._update(from, to, ids, values);
    }
}
