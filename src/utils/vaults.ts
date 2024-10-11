import { SuiObjectResponse } from '@mysten/sui/client'
import { Transaction, TransactionObjectArgument } from '@mysten/sui/transactions'
import {
  ClmmPoolUtil,
  GAS_TYPE_ARG,
  TickMath,
  TransactionUtil,
  asIntN,
  d,
  extractStructTagFromType,
  getObjectFields,
  getObjectType,
} from '@cetusprotocol/cetus-sui-clmm-sdk'

import Decimal from 'decimal.js'
import BN from 'bn.js'
import { FramsPositionNFT, PROTOCOL_FEE_DENOMINATOR, Vault, VaultStatus } from '../types'
import { CetusVaultsSDK } from '../sdk'

export class VaultsUtils {
  static generateNextTickRange(curr_index: number, span: number, tick_spacing: number) {
    const lower_index = curr_index - span / 2
    const upper_index = curr_index + span / 2

    return {
      new_tick_lower: VaultsUtils.getValidTickIndex(lower_index, tick_spacing),
      new_tick_upper: VaultsUtils.getValidTickIndex(upper_index, tick_spacing),
    }
  }

  static calculateDepositRatio(lowerTick: number, upperTick: number, curSqrtPrice: BN) {
    const currentTick = TickMath.sqrtPriceX64ToTickIndex(curSqrtPrice)
    if (currentTick < lowerTick) {
      return { ratioA: new Decimal(1), ratioB: new Decimal(0) }
    }
    if (currentTick > upperTick) {
      return { ratioA: new Decimal(0), ratioB: new Decimal(1) }
    }
    const coinAmountA = new BN(100000000)
    const { coinAmountB } = ClmmPoolUtil.estLiquidityAndcoinAmountFromOneAmounts(
      lowerTick,
      upperTick,
      coinAmountA,
      true,
      true,
      0,
      curSqrtPrice
    )

    const currPrice = TickMath.sqrtPriceX64ToPrice(curSqrtPrice, 0, 0)
    const transformAmountB = d(coinAmountA.toString()).mul(currPrice)
    const totalAmount = transformAmountB.add(coinAmountB.toString())
    const ratioA = transformAmountB.div(totalAmount)
    const ratioB = d(coinAmountB.toString()).div(totalAmount)

    return { ratioA, ratioB }
  }

  static getValidTickIndex(tickIndex: number, tickSpacing: number): number {
    if (tickIndex % tickSpacing === 0) {
      return tickIndex
    }

    let res: number
    if (tickIndex > 0) {
      res = tickIndex - (tickIndex % tickSpacing) + tickSpacing
    } else if (tickIndex < 0) {
      res = tickIndex + (Math.abs(tickIndex) % tickSpacing) - tickSpacing
    } else {
      res = tickIndex
    }

    if (res % tickSpacing !== 0) {
      throw new Error('Assertion failed: res % tickSpacing == 0')
    }

    if (Math.abs(res) < Math.abs(tickIndex)) {
      throw new Error('Assertion failed: res.abs() >= tickIndex')
    }

    return res
  }

  /**
   * lp_amount = (total_lp_amount * delta_liquidity) / total_liquidity_in_vault
   * @param total_amount
   * @param current_liquidity
   * @param total_liquidity
   */
  static get_lp_amount_by_liquidity(vault: Vault, current_liquidity: string) {
    if (vault.total_supply === '0') {
      return '0'
    }
    return d(vault.total_supply).mul(current_liquidity).div(vault.liquidity).toFixed(0, Decimal.ROUND_DOWN).toString()
  }

  /**
   * delta_liquidity = (lp_token_amount * total_liquidity_in_vault) / total_lp_amount
   * @param vault
   * @param current_amount
   * @returns
   */
  static get_share_liquidity_by_amount(vault: Vault, current_amount: string) {
    if (vault.total_supply === '0') {
      return '0'
    }
    return d(current_amount).mul(vault.liquidity).div(vault.total_supply).toFixed(0, Decimal.ROUND_DOWN).toString()
  }

  static get_protocol_fee_amount(vault: Vault, amount: string) {
    return d(amount).mul(vault.protocol_fee_rate).div(PROTOCOL_FEE_DENOMINATOR).toFixed(0, Decimal.ROUND_CEIL)
  }

  static buildFramsPositionNFT(fields: any): FramsPositionNFT {
    const clmmFields = fields.clmm_postion.fields
    const framsPositinNft: FramsPositionNFT = {
      id: fields.id.id,
      url: clmmFields.url,
      pool_id: fields.pool_id,
      coinTypeA: extractStructTagFromType(clmmFields.coin_type_a.fields.name).full_address,
      coinTypeB: extractStructTagFromType(clmmFields.coin_type_b.fields.name).full_address,
      description: clmmFields.description,
      name: clmmFields.name,
      liquidity: clmmFields.liquidity,
      clmm_position_id: clmmFields.id.id,
      clmm_pool_id: clmmFields.pool,
      tick_lower_index: asIntN(BigInt(clmmFields.tick_lower_index.fields.bits)),
      tick_upper_index: asIntN(BigInt(clmmFields.tick_upper_index.fields.bits)),
      rewards: [],
    }
    return framsPositinNft
  }

  static buildPool(objects: SuiObjectResponse): Vault | undefined {
    console.log('🚀🚀🚀 ~ file: vaults.ts:135 ~ VaultsUtils ~ buildPool ~ objects:', objects)
    const fields = getObjectFields(objects)
    const type = getObjectType(objects) as string
    const { positions } = fields
    if (fields && positions.length > 0) {
      const framsPosition = VaultsUtils.buildFramsPositionNFT(positions[0].fields)
      const masterNFT: Vault = {
        id: fields.id.id,
        pool_id: fields.pool,
        protocol_fee_rate: fields.protocol_fee_rate,
        is_pause: fields.is_pause,
        harvest_assets: {
          harvest_assets_handle: fields.harvest_assets.fields.id.id,
          size: Number(fields.harvest_assets.fields.size),
        },
        lp_token_type: extractStructTagFromType(type).type_arguments[0],
        total_supply: fields.lp_token_treasury.fields.total_supply.fields.value,
        liquidity: fields.liquidity,
        max_quota: fields.max_quota,
        status: fields.status === 1 ? VaultStatus.STATUS_RUNNING : VaultStatus.STATUS_REBALANCING,
        quota_based_type: fields.quota_based_type.fields.name,
        position: framsPosition,
      }
      return masterNFT
    }
    return undefined
  }

  static async getSuiCoin(sdk: CetusVaultsSDK, amount: number, tx?: Transaction): Promise<TransactionObjectArgument> {
    const allCoinAsset = await sdk.getOwnerCoinAssets(sdk.getVerifySenderAddress(), GAS_TYPE_ARG)
    tx = tx || new Transaction()
    let suiCoin
    if (amount > 950000000000) {
      const [fisrtCoin, ...otherCoins] = allCoinAsset
      if (otherCoins.length > 0) {
        tx.mergeCoins(
          tx.object(fisrtCoin.coinObjectId),
          otherCoins.map((coin) => tx!.object(coin.coinObjectId))
        )
      }
      suiCoin = tx.splitCoins(tx.object(fisrtCoin.coinObjectId), [amount])
    } else {
      suiCoin = TransactionUtil.buildCoinForAmount(tx, allCoinAsset, BigInt(amount), GAS_TYPE_ARG, false, true).targetCoin
    }

    return suiCoin
  }
}
