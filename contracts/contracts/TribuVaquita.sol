// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.24;

// La vaquita as a real wallet: a tribu's shared pot of USDC or USDT, held by this contract.
//
// What it guarantees:
// - Nobody runs it. There is no owner, no admin key, no pause and no upgrade. Tribu cannot move,
//   freeze or take anyone's money; only the pot's members can, by the rules below.
// - Each member's part is tracked. A deposit adds to the depositor's part. A payment from the pot
//   comes out of every part in proportion to its size, so everyone pays their share of it.
// - Paying out needs approvals. A member proposes a payment; it goes out once enough members
//   approve (the pot sets how many). The same rule adds or removes members and changes the count.
// - Nobody is locked in. A member can take out their own part, or leave with it, at any time,
//   without asking.
//
// A pot can earn: chosen when it is created, its money is supplied to Aave and every part grows by
// Aave's interest, in proportion to its size. That adds Aave's own risks (a bug or a bad debt
// there, or a moment when Aave has lent out everything and a withdrawal must wait).
//
// One deployment holds every tribu's pot. A pot's id is keccak256(abi.encode(creator, salt)), so
// the app knows it before the creating transaction is mined and nobody can squat another
// creator's id.

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// The part of Aave v3's Pool this contract uses.
interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
    /// Grows from 1e27 as interest accrues: an amount supplied at index i is worth amount * now / i.
    function getReserveNormalizedIncome(address asset) external view returns (uint256);
}

contract TribuVaquita is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// Payments split across members in a loop, so the roster is capped.
    uint256 public constant MAX_MEMBERS = 20;
    uint256 private constant RAY = 1e27;

    enum Action {
        Pay, // send `amount` to `target`
        AddMember, // add `target`
        RemoveMember, // remove `target`, who gets their part back
        SetApprovals // require `amount` approvals from now on
    }

    struct Proposal {
        Action action;
        address target;
        uint256 amount;
        bytes32 memo; // the app's reference for the description, which stays off-chain
        address proposer;
        bool executed;
        bool cancelled;
    }

    // Parts are kept "scaled", as Aave keeps balances: a part's value is scaled * index / RAY, where
    // the index is Aave's for an earning pot and RAY (so value == scaled) for one that does not.
    // Interest then grows every part of a pot in proportion without touching each one.
    struct Pot {
        address token;
        bool earns;
        uint256 approvalsNeeded;
        uint256 scaledTotal;
        address[] members;
    }

    /// The stablecoins a pot may hold, fixed at deployment.
    mapping(address => bool) public allowedToken;
    /// Aave's Pool, or zero on a network where pots cannot earn. Fixed at deployment.
    IAavePool public immutable aavePool;

    mapping(bytes32 => Pot) private pots;
    mapping(bytes32 => mapping(address => bool)) public isMember;
    mapping(bytes32 => mapping(address => uint256)) private scaledPartOf;
    mapping(bytes32 => Proposal[]) private proposals;

    // How many times an address has joined a pot. An approval records the stint it was given in,
    // so a member who is removed and added back does not bring old approvals with them.
    mapping(bytes32 => mapping(address => uint256)) private stint;
    mapping(bytes32 => mapping(uint256 => mapping(address => uint256))) private approvalStint;

    event PotCreated(
        bytes32 indexed potId, address indexed creator, address token, bool earns, address[] members, uint256 approvalsNeeded
    );
    event Deposited(bytes32 indexed potId, address indexed member, uint256 amount);
    event Withdrawn(bytes32 indexed potId, address indexed member, uint256 amount);
    event Proposed(
        bytes32 indexed potId,
        uint256 indexed proposalId,
        address indexed proposer,
        Action action,
        address target,
        uint256 amount,
        bytes32 memo
    );
    event Approved(bytes32 indexed potId, uint256 indexed proposalId, address indexed member);
    event Executed(bytes32 indexed potId, uint256 indexed proposalId);
    event Cancelled(bytes32 indexed potId, uint256 indexed proposalId);
    event Paid(bytes32 indexed potId, address indexed to, uint256 amount);
    event MemberAdded(bytes32 indexed potId, address indexed member);
    event MemberRemoved(bytes32 indexed potId, address indexed member, uint256 refunded);
    event ApprovalsNeededChanged(bytes32 indexed potId, uint256 approvalsNeeded);

    error TokenNotAllowed();
    error EarningNotAvailable();
    error PotExists();
    error PotNotFound();
    error BadMembers();
    error BadApprovals();
    error NotMember();
    error BadAmount();
    error BadTarget();
    error ProposalClosed();
    error AlreadyApproved();
    error NotEnoughApprovals();
    error NotProposer();
    error LastMember();

    constructor(address[] memory tokens, address aavePool_) {
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == address(0)) revert TokenNotAllowed();
            allowedToken[tokens[i]] = true;
        }
        aavePool = IAavePool(aavePool_);
    }

    modifier onlyMember(bytes32 potId) {
        if (pots[potId].token == address(0)) revert PotNotFound();
        if (!isMember[potId][msg.sender]) revert NotMember();
        _;
    }

    // ---- Creating ----

    function potIdFor(address creator, bytes32 salt) public pure returns (bytes32) {
        return keccak256(abi.encode(creator, salt));
    }

    function createPot(bytes32 salt, address token, bool earns, address[] calldata members, uint256 approvalsNeeded)
        external
        returns (bytes32 potId)
    {
        if (!allowedToken[token]) revert TokenNotAllowed();
        // Aave answers zero for an asset it does not list, so this also checks the token is there.
        if (earns && (address(aavePool) == address(0) || aavePool.getReserveNormalizedIncome(token) == 0)) {
            revert EarningNotAvailable();
        }
        potId = potIdFor(msg.sender, salt);
        Pot storage pot = pots[potId];
        if (pot.token != address(0)) revert PotExists();
        if (members.length == 0 || members.length > MAX_MEMBERS) revert BadMembers();
        if (approvalsNeeded == 0 || approvalsNeeded > members.length) revert BadApprovals();

        pot.token = token;
        pot.earns = earns;
        pot.approvalsNeeded = approvalsNeeded;
        bool creatorListed = false;
        for (uint256 i = 0; i < members.length; i++) {
            address member = members[i];
            if (member == address(0) || member == address(this) || isMember[potId][member]) revert BadMembers();
            if (member == msg.sender) creatorListed = true;
            _addMember(potId, member);
        }
        if (!creatorListed) revert BadMembers();
        emit PotCreated(potId, msg.sender, token, earns, members, approvalsNeeded);
    }

    // ---- Money in and out of your own part ----

    /// Pulls `amount` of the pot's token from the caller, who must have approved this contract.
    function deposit(bytes32 potId, uint256 amount) external nonReentrant onlyMember(potId) {
        if (amount == 0) revert BadAmount();
        Pot storage pot = pots[potId];
        IERC20 token = IERC20(pot.token);
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - before;
        uint256 index = _index(pot);
        if (pot.earns) {
            token.forceApprove(address(aavePool), received);
            aavePool.supply(pot.token, received, address(this), 0);
        }
        // Rounded down: a part never claims more than what was actually put in.
        uint256 scaled = (received * RAY) / index;
        scaledPartOf[potId][msg.sender] += scaled;
        pot.scaledTotal += scaled;
        emit Deposited(potId, msg.sender, received);
    }

    /// Takes `amount` out of the caller's own part. No approvals needed.
    function withdraw(bytes32 potId, uint256 amount) external nonReentrant onlyMember(potId) {
        if (amount == 0 || amount > partOf(potId, msg.sender)) revert BadAmount();
        _takeFromPart(potId, msg.sender, amount);
        _send(potId, msg.sender, amount);
        emit Withdrawn(potId, msg.sender, amount);
    }

    /// Takes the caller's whole part and leaves the pot. The last member cannot leave.
    function leave(bytes32 potId) external nonReentrant onlyMember(potId) {
        _removeMember(potId, msg.sender);
    }

    // ---- Proposals ----

    /// Proposing counts as the proposer's approval, so with one approval needed it runs at once.
    function propose(bytes32 potId, Action action, address target, uint256 amount, bytes32 memo)
        external
        nonReentrant
        onlyMember(potId)
        returns (uint256 proposalId)
    {
        _validate(potId, action, target, amount);
        proposalId = proposals[potId].length;
        proposals[potId].push(Proposal(action, target, amount, memo, msg.sender, false, false));
        emit Proposed(potId, proposalId, msg.sender, action, target, amount, memo);
        _approve(potId, proposalId);
    }

    /// Runs the proposal as soon as it has enough approvals and can still be carried out.
    function approve(bytes32 potId, uint256 proposalId) external nonReentrant onlyMember(potId) {
        _open(potId, proposalId);
        if (hasApproved(potId, proposalId, msg.sender)) revert AlreadyApproved();
        _approve(potId, proposalId);
    }

    /// For a proposal that had its approvals but could not run then (say, the pot was short).
    function execute(bytes32 potId, uint256 proposalId) external nonReentrant onlyMember(potId) {
        _open(potId, proposalId);
        if (approvalCount(potId, proposalId) < pots[potId].approvalsNeeded) revert NotEnoughApprovals();
        _execute(potId, proposalId);
    }

    function cancel(bytes32 potId, uint256 proposalId) external onlyMember(potId) {
        Proposal storage proposal = _open(potId, proposalId);
        if (proposal.proposer != msg.sender) revert NotProposer();
        proposal.cancelled = true;
        emit Cancelled(potId, proposalId);
    }

    // ---- Reading ----

    function getPot(bytes32 potId)
        external
        view
        returns (address token, bool earns, uint256 approvalsNeeded, uint256 total, address[] memory members)
    {
        Pot storage pot = pots[potId];
        uint256 value = pot.token == address(0) ? 0 : _value(pot.scaledTotal, _index(pot));
        return (pot.token, pot.earns, pot.approvalsNeeded, value, pot.members);
    }

    /// What `member` could take out right now, interest included.
    function partOf(bytes32 potId, address member) public view returns (uint256) {
        Pot storage pot = pots[potId];
        if (pot.token == address(0)) return 0;
        return _value(scaledPartOf[potId][member], _index(pot));
    }

    function proposalCount(bytes32 potId) external view returns (uint256) {
        return proposals[potId].length;
    }

    function getProposal(bytes32 potId, uint256 proposalId)
        external
        view
        returns (Proposal memory proposal, uint256 approvals)
    {
        return (proposals[potId][proposalId], approvalCount(potId, proposalId));
    }

    /// Approvals from current members only.
    function approvalCount(bytes32 potId, uint256 proposalId) public view returns (uint256 count) {
        address[] storage members = pots[potId].members;
        for (uint256 i = 0; i < members.length; i++) {
            if (hasApproved(potId, proposalId, members[i])) count++;
        }
    }

    function hasApproved(bytes32 potId, uint256 proposalId, address member) public view returns (bool) {
        uint256 current = stint[potId][member];
        return current != 0 && isMember[potId][member] && approvalStint[potId][proposalId][member] == current;
    }

    // ---- Internals ----

    function _index(Pot storage pot) private view returns (uint256) {
        return pot.earns ? aavePool.getReserveNormalizedIncome(pot.token) : RAY;
    }

    function _value(uint256 scaled, uint256 index) private pure returns (uint256) {
        return (scaled * index) / RAY;
    }

    /// Scaled units that cover `amount`, rounded up so the pot never pays out more than it books.
    function _scaledUp(uint256 amount, uint256 index) private pure returns (uint256) {
        return (amount * RAY + index - 1) / index;
    }

    function _open(bytes32 potId, uint256 proposalId) private view returns (Proposal storage proposal) {
        if (proposalId >= proposals[potId].length) revert ProposalClosed();
        proposal = proposals[potId][proposalId];
        if (proposal.executed || proposal.cancelled) revert ProposalClosed();
    }

    function _total(bytes32 potId) private view returns (uint256) {
        Pot storage pot = pots[potId];
        return _value(pot.scaledTotal, _index(pot));
    }

    function _validate(bytes32 potId, Action action, address target, uint256 amount) private view {
        Pot storage pot = pots[potId];
        if (action == Action.Pay) {
            if (target == address(0) || target == address(this)) revert BadTarget();
            if (amount == 0 || amount > _total(potId)) revert BadAmount();
        } else if (action == Action.AddMember) {
            if (target == address(0) || target == address(this) || isMember[potId][target]) revert BadTarget();
            if (pot.members.length >= MAX_MEMBERS) revert BadMembers();
        } else if (action == Action.RemoveMember) {
            if (!isMember[potId][target]) revert BadTarget();
            if (pot.members.length == 1) revert LastMember();
        } else {
            if (amount == 0 || amount > pot.members.length) revert BadApprovals();
        }
    }

    function _approve(bytes32 potId, uint256 proposalId) private {
        approvalStint[potId][proposalId][msg.sender] = stint[potId][msg.sender];
        emit Approved(potId, proposalId, msg.sender);
        if (approvalCount(potId, proposalId) >= pots[potId].approvalsNeeded && _canExecute(potId, proposalId)) {
            _execute(potId, proposalId);
        }
    }

    function _canExecute(bytes32 potId, uint256 proposalId) private view returns (bool) {
        Proposal storage proposal = proposals[potId][proposalId];
        Pot storage pot = pots[potId];
        if (proposal.action == Action.Pay) return proposal.amount <= _total(potId);
        if (proposal.action == Action.AddMember) {
            return !isMember[potId][proposal.target] && pot.members.length < MAX_MEMBERS;
        }
        if (proposal.action == Action.RemoveMember) {
            return isMember[potId][proposal.target] && pot.members.length > 1;
        }
        return proposal.amount <= pot.members.length;
    }

    function _execute(bytes32 potId, uint256 proposalId) private {
        // Re-checked here because the pot may have changed since the proposal was made.
        Proposal storage proposal = proposals[potId][proposalId];
        Action action = proposal.action;
        address target = proposal.target;
        uint256 amount = proposal.amount;
        _validate(potId, action, target, amount);
        proposal.executed = true;
        emit Executed(potId, proposalId);

        if (action == Action.Pay) {
            _chargeEveryPart(potId, amount);
            _send(potId, target, amount);
            emit Paid(potId, target, amount);
        } else if (action == Action.AddMember) {
            _addMember(potId, target);
        } else if (action == Action.RemoveMember) {
            _removeMember(potId, target);
        } else {
            pots[potId].approvalsNeeded = amount;
            emit ApprovalsNeededChanged(potId, amount);
        }
    }

    /// Takes `amount` out of the parts in proportion to their size. Rounding leftovers (fewer
    /// scaled units than there are members) come one unit each from members who still have some.
    function _chargeEveryPart(bytes32 potId, uint256 amount) private {
        Pot storage pot = pots[potId];
        uint256 scaledTotal = pot.scaledTotal;
        uint256 charge = _scaledUp(amount, _index(pot));
        // Paying out everything can round one unit past the booked total.
        if (charge > scaledTotal) charge = scaledTotal;
        address[] storage members = pot.members;
        uint256 left = charge;
        for (uint256 i = 0; i < members.length; i++) {
            uint256 part = scaledPartOf[potId][members[i]];
            uint256 share = (part * charge) / scaledTotal;
            scaledPartOf[potId][members[i]] = part - share;
            left -= share;
        }
        for (uint256 i = 0; i < members.length && left > 0; i++) {
            if (scaledPartOf[potId][members[i]] > 0) {
                scaledPartOf[potId][members[i]] -= 1;
                left -= 1;
            }
        }
        // Holds because every part is owned by a current member and the parts sum to the total.
        assert(left == 0);
        pot.scaledTotal = scaledTotal - charge;
    }

    function _takeFromPart(bytes32 potId, address member, uint256 amount) private {
        Pot storage pot = pots[potId];
        uint256 scaled = _scaledUp(amount, _index(pot));
        uint256 part = scaledPartOf[potId][member];
        // Taking a whole part can round one unit past it.
        if (scaled > part) scaled = part;
        scaledPartOf[potId][member] = part - scaled;
        pot.scaledTotal -= scaled;
    }

    function _send(bytes32 potId, address to, uint256 amount) private {
        Pot storage pot = pots[potId];
        if (pot.earns) {
            aavePool.withdraw(pot.token, amount, to);
        } else {
            IERC20(pot.token).safeTransfer(to, amount);
        }
    }

    function _addMember(bytes32 potId, address member) private {
        pots[potId].members.push(member);
        isMember[potId][member] = true;
        stint[potId][member] += 1;
        emit MemberAdded(potId, member);
    }

    function _removeMember(bytes32 potId, address member) private {
        Pot storage pot = pots[potId];
        if (pot.members.length == 1) revert LastMember();
        address[] storage members = pot.members;
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] == member) {
                members[i] = members[members.length - 1];
                members.pop();
                break;
            }
        }
        isMember[potId][member] = false;
        if (pot.approvalsNeeded > members.length) {
            pot.approvalsNeeded = members.length;
            emit ApprovalsNeededChanged(potId, members.length);
        }
        uint256 part = partOf(potId, member);
        pot.scaledTotal -= scaledPartOf[potId][member];
        scaledPartOf[potId][member] = 0;
        if (part > 0) _send(potId, member, part);
        emit MemberRemoved(potId, member, part);
    }
}
