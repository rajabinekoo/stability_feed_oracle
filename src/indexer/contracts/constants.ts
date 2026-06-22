export const indexerTimeout = 40_000;

/// @notice Emitted when liquidity is minted for a given position
/// @param sender The address that minted the liquidity
/// @param owner The owner of the position and recipient of any minted liquidity
/// @param tickLower The lower tick of the position
/// @param tickUpper The upper tick of the position
/// @param amount The amount of liquidity minted to the position range
/// @param amount0 How much token0 was required for the minted liquidity
/// @param amount1 How much token1 was required for the minted liquidity
export const mintEventSignature =
  'event Mint(address sender,address indexed owner,int24 indexed tickLower,int24 indexed tickUpper,uint128 amount,uint256 amount0,uint256 amount1)';

/// @notice Emitted when a position's liquidity is removed
/// @dev Does not withdraw any fees earned by the liquidity position, which must be withdrawn via #collect
/// @param owner The owner of the position for which liquidity is removed
/// @param tickLower The lower tick of the position
/// @param tickUpper The upper tick of the position
/// @param amount The amount of liquidity to remove
/// @param amount0 The amount of token0 withdrawn
/// @param amount1 The amount of token1 withdrawn
export const burnEventSignature =
  'event Burn(address indexed owner,int24 indexed tickLower,int24 indexed tickUpper,uint128 amount,uint256 amount0,uint256 amount1)';

/// @notice Emitted by the pool for any swaps between token0 and token1
/// @param sender The address that initiated the swap call, and that received the callback
/// @param recipient The address that received the output of the swap
/// @param amount0 The delta of the token0 balance of the pool
/// @param amount1 The delta of the token1 balance of the pool
/// @param sqrtPriceX96 The sqrt(price) of the pool after the swap, as a Q64.96
/// @param liquidity The liquidity of the pool after the swap
/// @param tick The log base 1.0001 of price of the pool after the swap
export const swapEventSignature =
  'event Swap(address indexed sender,address indexed recipient,int256 amount0,int256 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick)';

// https://etherscan.io/address/0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640#code
