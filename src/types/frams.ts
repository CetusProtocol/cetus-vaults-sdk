import { CoinPairType, SuiAddressType } from '@cetusprotocol/cetus-sui-clmm-sdk'
import { TransactionArgument } from '@mysten/sui/transactions'

export type FrarmsConfigs = {
  global_config_id: string
  rewarder_manager_id: string
  rewarder_manager_handle: string
  admin_cap_id?: string
}
/**
 * The frams position NFT.
 */
export type FramsPositionNFT = {
  id: string
  pool_id: string
  url: string
  description: string
  name: string
  liquidity: string
  clmm_position_id: string
  clmm_pool_id: string
  tick_lower_index: number
  tick_upper_index: number
  rewards: PositionRewardInfo[]
} & CoinPairType

/**
 * The staked CLMM position reward info.
 */
export type PositionRewardInfo = {
  rewarder_type: string
  rewarder_amount: string
}

/**
 *  The stable farming pool for stake CLMM position and get reward.
 */
export type FramsPool = {
  id: string
  clmm_pool_id: string
  effective_tick_lower: number
  effective_tick_upper: number
  // The sqrt price(Q64X64) of CoinA
  sqrt_price: string
  total_share: string
  rewarders: RewarderConfig[]
  positions: {
    positions_handle: string
    size: number
  }
}

export type RewarderConfig = {
  reward_coin: string
  last_reward_time: string
  emission_per_second: string
  total_allocate_point: string
  allocate_point: string
}

export type HarvestParams = {
  pool_id: string
  position_nft_id: string
}

export type HarvestFeeAndClmmRewarderParams = {
  pool_id: string
  position_nft_id: string
  clmm_pool_id: string
  collect_fee: boolean
  collect_frams_rewarder: boolean
  clmm_rewarder_types: SuiAddressType[]
  coinTypeA: string
  coinTypeB: string
}

export type ClaimFeeAndClmmRewardParams = {
  coinTypeA: string
  coinTypeB: string
  clmm_pool_id: string
  position_nft_id: string
  collect_fee: boolean
  clmm_rewarder_types: SuiAddressType[]
}

export type FramsDepositParams = {
  pool_id: string
  clmm_position_id: string
}

export type FramsWithdrawParams = {
  pool_id: string
  position_nft_id: string
}

export type AddLiquidityParams = {
  pool_id: string
  clmm_pool_id: string
  position_nft_id: string
  amount_limit_a: string
  amount_limit_b: string
  delta_liquidity: string
  collect_fee: boolean
  collect_rewarder: boolean
  clmm_rewarder_types: string[]
} & CoinPairType

export type OpenPositionAddLiquidityStakeParams = {
  pool_id: string
  clmm_pool_id: string
  tick_lower: number
  tick_upper: number
  amount_a: string
  amount_b: string
  fix_amount_a: boolean
} & CoinPairType

export type AddLiquidityFixCoinParams = {
  pool_id: string
  clmm_pool_id: string
  position_nft_id: string
  amount_a: string | number
  amount_b: string | number
  collect_fee: boolean
  collect_rewarder: boolean
  fix_amount_a: boolean
  clmm_rewarder_types: string[]
} & CoinPairType

export type RemoveLiquidityParams = {
  pool_id: string
  clmm_pool_id: string
  position_nft_id: string
  min_amount_a: string
  min_amount_b: string
  delta_liquidity: string
  collect_rewarder: boolean
  unstake: boolean
  close_position: boolean
  clmm_position_id?: string
  clmm_rewarder_types: string[]
} & CoinPairType

export type CollectFeeParams = {
  clmm_pool_id: string
  position_nft_id: string
  // coin_a?: TransactionArgument
  // coin_b?: TransactionArgument
} & CoinPairType

export type CollectClmmRewardParams = {
  clmm_pool_id: string
  position_nft_id: string
  reward_coins?: TransactionArgument[]
  clmm_rewarder_types: SuiAddressType[]
} & CoinPairType
