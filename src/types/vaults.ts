import { Env } from '@cetusprotocol/aggregator-sdk'
import { AggregatorResult, CoinPairType, Package, SuiAddressType } from '@cetusprotocol/cetus-sui-clmm-sdk'
import { FramsPositionNFT } from './frams'

export const VaultsRouterModule = 'router'
export const VaultsVaultModule = 'vaults'
export const PROTOCOL_FEE_DENOMINATOR = 10000

export type VaultsConfigs = {
  admin_cap_id: string
  vaults_manager_id: string
  vaults_pool_handle: string
  haedal?: Package<HaedalConfigs>
  volo?: Package<VoloConfigs>
  aftermath?: Package<AftermathConfigs>
}

export type HaedalConfigs = {
  staking_id: string
  coin_type: string
}

export type VoloConfigs = {
  native_pool: string
  vsui_metadata: string
  coin_type: string
}
// https://ch-docs.aftermath.finance/liu-dong-zhi-ya/he-yue
// https://aftermath.finance/api/staking/validator-configs
// https://testnet.aftermath.finance/api/staking/validator-configs
export type AftermathConfigs = {
  staked_sui_vault: string
  referral_vault: string
  safe: string
  validator_address: string
  coin_type: string
}

export enum VaultStatus {
  STATUS_RUNNING = 'STATUS_RUNNING',
  STATUS_REBALANCING = 'STATUS_REBALANCING',
}

export enum StakeProtocol {
  Haedal = 'Haedal',
  Volo = 'Volo',
  Aftermath = 'aftermath',
}

export type Vault = {
  id: string
  pool_id: string
  lp_token_type: string
  liquidity: string
  protocol_fee_rate: string
  is_pause: boolean
  harvest_assets: {
    harvest_assets_handle: string
    size: number
  }
  total_supply: string
  position: FramsPositionNFT
  max_quota: string
  quota_based_type: string
  status: VaultStatus
  stake_protocol?: SuiStakeProtocol
}

// export type DepositParams = {
//   vault_id: string
//   clmm_pool: string
//   farming_pool: string
//   lp_token_type: SuiAddressType
//   amount_a: string
//   amount_b: string
//   lowerTick: number
//   upperTick: number
//   fix_amount_a: boolean
//   slippage: number
//   swapParams?: {
//     input_amount: string
//     swap_amount: string
//     a2b: boolean
//     stakeProtocol?: StakeProtocol
//     route_obj?: any
//   }
//   aggregatorConfig: AggregatorCoinfig
// } & CoinPairType

export type RemoveParams = {
  vault_id: string
  clmm_pool: string
  slippage: number
  lp_token_type: SuiAddressType
  farming_pool: string
  lp_token_amount: string
  min_amount_a: string
  min_amount_b: string
  swapParams?: {
    swap_amount: string
    a2b: boolean
    route_obj?: any
  }
  aggregatorConfig: AggregatorCoinfig
} & CoinPairType

export type CalculateDepositOnlyParams = {
  lowerTick: number
  upperTick: number
  curSqrtPrice: string
  fix_amount_a: boolean
  input_amount: string
  priceSplitPoint: number
  remainRate?: number
  clmm_pool: string
  request_id?: string
  use_route: boolean
  stakeProtocol?: StakeProtocol
  shouldRequestStake: boolean
  aggregatorConfig: AggregatorCoinfig
  pools: string[]
} & CoinPairType

export type CalculateHaedalDepositOnlyParams = {
  lowerTick: number
  upperTick: number
  curSqrtPrice: string
  fix_amount_a: boolean
  input_amount: string
  priceSplitPoint: number
  remainRate?: number
  clmm_pool: string
  request_id?: string
  stakeProtocol: StakeProtocol
  shouldRequestStake: boolean
} & CoinPairType

export type CalculateDepositOnlyResult = {
  swapInAmount: string
  swapOutAmount: string
  afterSqrtPrice: string
  fixAmountA: boolean
  is_exceed: boolean
  request_id?: string
  routeObj?: AggregatorResult
  stake_protocol?: StakeProtocol
}

export type CalculateMaxAvailableParams = {
  lowerTick: number
  upperTick: number
  curSqrtPrice: string
  input_amount: string
  clmm_pool: string
} & CoinPairType

export type CalculateRemoveOnlyParams = {
  lowerTick: number
  upperTick: number
  curSqrtPrice: string
  fix_amount_a: boolean
  receive_amount: string
  use_route: boolean
  clmm_pool: string
  priceSplitPoint: number
  removeLiquidity?: string
  maxLiquidity: string
  request_id: string
  aggregatorConfig: AggregatorCoinfig
  pools: string[]
} & CoinPairType

export type CalculateRemoveOnlyResult = {
  is_exceed: boolean
  swapInAmount: string
  swapOutAmount: string
  liquidity: string
  request_id: string
  a2b: boolean
  byamountIn: boolean
  routeObj?: AggregatorResult
}

export type AggregatorCoinfig = {
  endPoint: string
  fullNodeurl: string
  walletAddress: string
  env: Env
  providers: string[]
}

export enum SuiStakeProtocol {
  Cetus = 'Cetus',
  Haedal = 'Haedal',
  Volo = 'Volo',
  Aftermath = 'aftermath',
}

export enum InputType {
  Both = 'both',
  OneSide = 'oneSide',
}

export type CalculateAmountParams = {
  vault_id: string
  fix_amount_a: boolean
  input_amount: string
  slippage: number
  side: InputType
  request_id?: string
}

export type CalculateAmountResult = {
  request_id?: string
  side: InputType
  amount_a: string
  amount_b: string
  amount_limit_a: string
  amount_limit_b: string
  ft_amount: string
  fix_amount_a: boolean
  swap_result?: SwapAmountResult
  partner?: string
}

export type SwapAmountResult = {
  swap_in_amount: string
  swap_out_amount: string
  a2b: boolean
  is_exceed: boolean
  sui_stake_protocol: SuiStakeProtocol
  afterSqrtPrice?: string
  route_obj?: any
}

export type CalculateRemoveAmountParams = {
  vault_id: string
  fix_amount_a: boolean
  is_ft_input: boolean
  input_amount: string
  max_ft_amount: string
  slippage: number
  side: InputType
  request_id?: string
}

export type CalculateRemoveAmountResult = {
  request_id?: string
  side: InputType
  amount_a: string
  amount_b: string
  amount_limit_a: string
  amount_limit_b: string
  burn_ft_amount: string
  swap_result?: SwapAmountResult
}

export type DepositParams = {
  vault_id: string
  side: InputType
  fix_amount_a: boolean
  input_amount: string
  slippage: number
  partner?: string
}

export type WithdrawBothParams = {
  vault_id: string
  ft_amount: string
  slippage: number
}

export type WithdrawOneSideParams = {
  vault_id: string
  fix_amount_a: boolean
  is_ft_input: boolean
  input_amount: string
  max_ft_amount: string
  slippage: number
  partner?: string
}
