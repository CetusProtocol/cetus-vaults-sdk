/* eslint-disable no-useless-catch */
import { AggregatorClient, FindRouterParams, PreSwapLpChangeParams } from '@cetusprotocol/aggregator-sdk'
import {
  BuildCoinResult,
  CachedContent,
  ClmmPoolUtil,
  CoinAssist,
  SwapUtils,
  TickMath,
  TransactionUtil,
  cacheTime24h,
  d,
  extractStructTagFromType,
  getFutureTime,
  getObjectFields,
} from '@cetusprotocol/cetus-sui-clmm-sdk'
import { SuiClient } from '@mysten/sui/client'
import { Transaction, TransactionArgument, TransactionObjectArgument } from '@mysten/sui/transactions'
import { BN } from 'bn.js'
import Decimal from 'decimal.js'
import { IModule } from '../interfaces/IModule'
import {
  CalculateAmountParams,
  CalculateAmountResult,
  CalculateRemoveAmountParams,
  CalculateRemoveAmountResult,
  DepositParams,
  InputType,
  SuiStakeProtocol,
  Vault,
  VaultsConfigs,
  VaultsRouterModule,
  VaultsVaultModule,
  WithdrawBothParams,
  WithdrawOneSideParams,
} from '../types'
import { CoinAsset, getPackagerConfigs } from '../types/clmm_type'
import { AftermathoUtils, HaedalUtils, VaultsUtils, VoloUtils } from '../utils'

import { CetusVaultsSDK } from '../sdk'
import { CLOCK_ADDRESS, ClmmIntegrateRouterModule, DataPage, PaginationArgs } from '../types/sui'

/**
 * Helper class to help interact with Vaults interface.
 */
export class VaultsModule implements IModule {
  protected _sdk: CetusVaultsSDK

  private readonly _cache: Record<string, CachedContent> = {}

  constructor(sdk: CetusVaultsSDK) {
    this._sdk = sdk
  }

  get sdk() {
    return this._sdk
  }

  async calculateDepositAmount(
    params: CalculateAmountParams,
    shouldRequestStake = false,
    adjustBestAmount = false
  ): Promise<CalculateAmountResult> {
    if (params.side === InputType.Both) {
      return await this.calculateAmountFromBoth(params, true)
    }
    return await this.calculateDepositAmountFromOneSide(params, shouldRequestStake, adjustBestAmount)
  }

  async calculateWithdrawAmount(params: CalculateRemoveAmountParams): Promise<CalculateRemoveAmountResult> {
    if (params.side === InputType.Both) {
      if (params.is_ft_input) {
        const amounts = await this.estLiquidityAmountFromFtAmount({
          ...params,
          input_ft_amount: params.input_amount,
        })
        return {
          ...amounts,
          request_id: params.input_amount,
          burn_ft_amount: params.input_amount,
          side: params.side,
        }
      }
      const res = await this.calculateAmountFromBoth(params, false)
      return {
        ...res,
        request_id: params.input_amount,
        burn_ft_amount: res.ft_amount,
        side: params.side,
      }
    }
    const { vault } = await this.getVaultAndPool(params.vault_id)
    const maxLiquidity = VaultsUtils.get_share_liquidity_by_amount(vault, params.max_ft_amount)
    return await this.calculateWithdrawAmountFromOneSide(
      {
        fix_amount_a: params.fix_amount_a,
        vault_id: params.vault_id,
        receive_amount: params.is_ft_input ? '0' : params.input_amount,
        slippage: params.slippage,
        maxLiquidity,
        removeLiquidity: params.is_ft_input ? VaultsUtils.get_share_liquidity_by_amount(vault, params.input_amount) : undefined,
      },
      true
    )
  }

  private async calculateWithdrawAmountFromOneSide(
    params: {
      fix_amount_a: boolean
      vault_id: string
      receive_amount: string
      slippage: number
      removeLiquidity?: string
      maxLiquidity: string
    },
    useRoute: boolean,
    range?: {
      left: Decimal
      right: Decimal
      count: number
    }
  ): Promise<CalculateRemoveAmountResult> {
    try {
      const { vault_id, removeLiquidity, maxLiquidity } = params
      // Get vault information
      const { vault, pool } = await this.getVaultAndPool(vault_id)
      const { position } = vault
      const lowerTick = position.tick_lower_index
      const upperTick = position.tick_upper_index

      const isRemoveAll = removeLiquidity === maxLiquidity

      const ratios = VaultsUtils.calculateDepositRatio(lowerTick, upperTick, new BN(pool.current_sqrt_price))
      const fixRatio = params.fix_amount_a ? ratios.ratioA : ratios.ratioB

      let fixAmount = d(params.receive_amount).mul(fixRatio)
      let otherSideAmount
      let liquidity

      // Remove by liquidity
      if (removeLiquidity) {
        const lowerSqrtPrice = TickMath.tickIndexToSqrtPriceX64(lowerTick)
        const upperSqrtPrice = TickMath.tickIndexToSqrtPriceX64(upperTick)
        const removeParams = ClmmPoolUtil.getCoinAmountFromLiquidity(
          new BN(removeLiquidity),
          new BN(pool.current_sqrt_price),
          lowerSqrtPrice,
          upperSqrtPrice,
          false
        )
        liquidity = removeLiquidity
        otherSideAmount = params.fix_amount_a ? removeParams.coinB.toString() : removeParams.coinA.toString()
        fixAmount = params.fix_amount_a ? d(removeParams.coinA.toString()) : d(removeParams.coinB.toString())
      } else {
        // Fixed fix_amount_a calculation of liquidity and value in the other direction
        const removeParams = ClmmPoolUtil.estLiquidityAndcoinAmountFromOneAmounts(
          lowerTick,
          upperTick,
          new BN(fixAmount.toFixed(0)),
          params.fix_amount_a,
          false,
          params.slippage,
          new BN(pool.current_sqrt_price)
        )
        liquidity = removeParams.liquidityAmount.toString()
        otherSideAmount = params.fix_amount_a ? removeParams.coinAmountB.toString() : removeParams.coinAmountA.toString()
      }
      // Swap otherSideAmount to get the expected value in the fix_amount_a direction
      const a2b = !params.fix_amount_a

      const data: any = await this.findRouters(
        pool.poolAddress,
        pool.current_sqrt_price.toString(),
        params.fix_amount_a ? pool.coinTypeB : pool.coinTypeA,
        params.fix_amount_a ? pool.coinTypeA : pool.coinTypeB,
        d(otherSideAmount),
        true,
        [pool.poolAddress],
        {
          poolID: pool.poolAddress,
          ticklower: lowerTick,
          tickUpper: upperTick,
          deltaLiquidity: Number(liquidity),
        }
      )

      const rclAmount = fixAmount.add(data.amount_out)
      const expectAmount = d(params.receive_amount)
      const ramainAmount = expectAmount.sub(rclAmount)

      if (!isRemoveAll && (!params.removeLiquidity || (params.removeLiquidity && range))) {
        if (ramainAmount.abs().greaterThan(expectAmount.mul(0.01))) {
          // amount is not enough
          const amountInsufficient = rclAmount.lessThan(expectAmount)
          let left
          let right
          if (!range) {
            left = amountInsufficient ? d(liquidity) : d(0)
            right = amountInsufficient ? d(params.maxLiquidity) : d(liquidity)
          }
          // Determine the remaining amount last time and the remaining amount this time
          else if (amountInsufficient) {
            left = d(liquidity)
            right = range.right
          } else {
            left = range.left
            right = d(liquidity)
          }

          const midLiquidity = d(left).add(right).div(2).toFixed(0)
          if (!range || (range && range.count < 15 && left < right)) {
            const swapResut = await this.calculateWithdrawAmountFromOneSide(
              {
                ...params,
                removeLiquidity: midLiquidity,
              },
              useRoute,
              {
                left,
                right,
                count: range ? range.count + 1 : 0,
              }
            )
            return swapResut
          }
        }
      }

      const swapInAmount =
        data.amount_in && data.fee_amount ? new BN(data.amount_in).add(new BN(data.fee_amount)).toString() : data.amount_in
      const swapOutAmount = data.amount_out
      const { is_exceed } = data

      const burn_ft_amount = VaultsUtils.get_lp_amount_by_liquidity(vault, liquidity.toString())
      const amounts = await this.estLiquidityAmountFromFtAmount({
        vault_id,
        input_ft_amount: burn_ft_amount,
        slippage: params.slippage,
      })

      const result: CalculateRemoveAmountResult = {
        side: InputType.OneSide,
        ...amounts,
        burn_ft_amount,
        request_id: params.receive_amount,
        swap_result: {
          swap_in_amount: swapInAmount,
          swap_out_amount: swapOutAmount,
          a2b,
          is_exceed,
          sui_stake_protocol: SuiStakeProtocol.Cetus,
          route_obj: data.route_obj,
        },
      }

      return result
    } catch (error) {
      if (useRoute && (String(error) === 'Error: route unavailable' || String(error) === 'Error: router timeout')) {
        return await this.calculateWithdrawAmountFromOneSide(params, false)
      }
      throw error
    }
  }

  private async calculateDepositAmountFromOneSide(
    params: CalculateAmountParams,
    shouldRequestStake: boolean,
    adjustBestAmount = false,
    useRoute = true,
    maxLoopLimit = 5,
    maxRemainRate = 0.02
  ): Promise<CalculateAmountResult> {
    try {
      const { vault_id, input_amount, fix_amount_a, slippage } = params
      // Get vault information
      const { vault, pool } = await this.getVaultAndPool(vault_id)
      const { position } = vault
      const lowerTick = position.tick_lower_index
      const upperTick = position.tick_upper_index

      const firstTick = TickMath.sqrtPriceX64ToTickIndex(new BN(pool.current_sqrt_price))
      const { ratioA, ratioB } = VaultsUtils.calculateDepositRatio(lowerTick, upperTick, new BN(pool.current_sqrt_price))

      const fixAmount = d(input_amount).mul(fix_amount_a ? ratioA : ratioB)
      const swapAmount = d(input_amount).sub(fixAmount)
      const a2b = fix_amount_a
      if (swapAmount.toFixed(0) === '0') {
        return await this.calculateAmountFromBoth(params, true)
      }

      let swapData
      let afterSqrtPrice
      let fixAmountA
      let swapInAmount
      let swapOutAmount
      const suiStakeProtocol = this.findSuiStakeProtocol(position.coinTypeA, position.coinTypeB, fix_amount_a)
      if (suiStakeProtocol !== SuiStakeProtocol.Cetus) {
        swapData = await this.calculateStakeDepositFixSui({
          inputSuiAmount: d(params.input_amount),
          swapSuiAmount: swapAmount,
          lowerTick,
          upperTick,
          curSqrtPrice: pool.current_sqrt_price.toString(),
          remainRate: 0.01,
          fixCoinA: params.fix_amount_a,
          rebalanceCount: 0,
          shouldRequestStake,
          leftSuiAmount: a2b ? new Decimal(swapAmount.toFixed(0)) : new Decimal(0),
          rightSuiAmount: a2b ? new Decimal(params.input_amount) : new Decimal(swapAmount.toFixed(0)),
          stakeProtocol: suiStakeProtocol,
        })
        afterSqrtPrice = pool.current_sqrt_price.toString()
        fixAmountA = swapData.fixAmountA
        swapInAmount = swapData.swapInAmount
        swapOutAmount = swapData.swapOutAmount
      } else {
        swapData = await this.findRouters(
          pool.poolAddress,
          pool.current_sqrt_price.toString(),
          a2b ? pool.coinTypeA : pool.coinTypeB,
          a2b ? pool.coinTypeB : pool.coinTypeA,
          swapAmount,
          true,
          [pool.poolAddress]
        )

        let paresSwapData = this.paresSwapData(
          swapData,
          params.input_amount,
          params.fix_amount_a,
          a2b,
          lowerTick,
          upperTick,
          ratioA,
          ratioB
        )
        const maxRemaining = d(params.input_amount).mul(maxRemainRate)
        if (d(params.input_amount).sub(paresSwapData.preAmountTotal).gt(maxRemaining)) {
          const rebalanceParams = {
            clmm_pool: pool.poolAddress,
            curSqrtPrice: pool.current_sqrt_price.toString(),
            a2b,
            amount_a: a2b ? d(input_amount) : d(0),
            amount_b: a2b ? d(0) : d(params.input_amount),
            amount_left: a2b ? d(swapAmount.toFixed(0)) : d(0),
            amount_right: a2b ? d(input_amount) : d(swapAmount.toFixed(0)),
            lowerTick,
            upperTick,
            tick_spacing: 2,
            coinTypeA: position.coinTypeA,
            coinTypeB: position.coinTypeB,
            remainRate: 0.02,
            priceSplitPoint: slippage,
            useRoute,
            maxLoopLimit,
          }
          const useRebalance = adjustBestAmount && firstTick <= upperTick

          swapData = useRebalance
            ? await this.calculateRebalance(rebalanceParams)
            : await this.findRouters(
                pool.poolAddress,
                pool.current_sqrt_price.toString(),
                a2b ? pool.coinTypeA : pool.coinTypeB,
                a2b ? pool.coinTypeB : pool.coinTypeA,
                swapAmount,
                true,
                [pool.poolAddress]
              )
        }

        afterSqrtPrice = swapData.after_sqrt_price

        paresSwapData = this.paresSwapData(swapData, params.input_amount, params.fix_amount_a, a2b, lowerTick, upperTick, ratioA, ratioB)

        fixAmountA = paresSwapData.fixAmountA
        swapInAmount = paresSwapData.swapInAmount
        swapOutAmount = paresSwapData.swapOutAmount
        afterSqrtPrice = paresSwapData.afterSqrtPrice
      }

      const coinAmount = fixAmountA === fix_amount_a ? d(input_amount).sub(swapInAmount).toFixed(0) : swapOutAmount

      const liquidityInput = ClmmPoolUtil.estLiquidityAndcoinAmountFromOneAmounts(
        lowerTick,
        upperTick,
        new BN(coinAmount),
        fixAmountA,
        true,
        slippage,
        new BN(afterSqrtPrice)
      )

      const amount_a = liquidityInput.coinAmountA.toString()
      const amount_b = liquidityInput.coinAmountB.toString()

      const lpAmount = VaultsUtils.get_lp_amount_by_liquidity(vault, liquidityInput.liquidityAmount.toString())
      return {
        request_id: params.input_amount,
        side: InputType.OneSide,
        amount_a,
        amount_b,
        amount_limit_a: liquidityInput.tokenMaxA.toString(),
        amount_limit_b: liquidityInput.tokenMaxB.toString(),
        ft_amount: lpAmount,
        fix_amount_a: fixAmountA,
        swap_result: {
          swap_in_amount: swapInAmount,
          swap_out_amount: swapOutAmount,
          a2b: fix_amount_a,
          sui_stake_protocol: suiStakeProtocol,
          route_obj: swapData.route_obj,
          is_exceed: swapData.is_exceed,
          afterSqrtPrice,
        },
      }
    } catch (error) {
      if (useRoute && (String(error) === 'Error: route unavailable' || String(error) === 'Error: router timeout')) {
        return await this.calculateDepositAmountFromOneSide(params, shouldRequestStake, false)
      }
      throw error
    }
  }

  paresSwapData(
    swapData: any,
    input_amount: string,
    fix_amount_a: boolean,
    a2b: boolean,
    lowerTick: number,
    upperTick: number,
    ratioA: Decimal,
    ratioB: Decimal
  ) {
    const afterSqrtPrice = swapData.after_sqrt_price
    const currentTick = TickMath.sqrtPriceX64ToTickIndex(new BN(afterSqrtPrice))
    const { ratioA: afterRatioA, ratioB: afterRatioB } = VaultsUtils.calculateDepositRatio(lowerTick, upperTick, new BN(afterSqrtPrice))
    let fixAmountA = afterRatioB.div(afterRatioA).sub(ratioB.div(ratioA)).greaterThan('0')

    const swapInAmount =
      swapData.amount_in && swapData.fee_amount
        ? new BN(swapData.amount_in).add(new BN(swapData.fee_amount)).toString()
        : swapData.amount_in
    const swapOutAmount = swapData.amount_out

    const coinAmount = fixAmountA === a2b ? new BN(d(input_amount).sub(swapInAmount).toString()) : new BN(swapOutAmount)

    let preAmountTotal = d(input_amount)

    if (currentTick < lowerTick) {
      fixAmountA = true
    } else if (currentTick > upperTick) {
      fixAmountA = false
    } else {
      const liquidityInput = ClmmPoolUtil.estLiquidityAndcoinAmountFromOneAmounts(
        lowerTick,
        upperTick,
        coinAmount,
        fixAmountA,
        true,
        0,
        new BN(afterSqrtPrice)
      )
      const amount_a = liquidityInput.coinAmountA
      const amount_b = liquidityInput.coinAmountB

      preAmountTotal = d(fix_amount_a ? amount_a.toString() : amount_b.toString()).add(swapInAmount)

      if (preAmountTotal.greaterThanOrEqualTo(input_amount)) {
        fixAmountA = !fixAmountA
      }
    }

    return {
      preAmountTotal,
      fixAmountA,
      swapInAmount,
      swapOutAmount,
      afterSqrtPrice,
    }
  }

  /**
   * @param params
   */
  async calculateStakeDepositFixSui(params: {
    inputSuiAmount: Decimal
    swapSuiAmount: Decimal
    leftSuiAmount: Decimal
    rightSuiAmount: Decimal
    lowerTick: number
    upperTick: number
    curSqrtPrice: string
    remainRate: number
    fixCoinA: boolean
    rebalanceCount: number
    shouldRequestStake: boolean
    stakeProtocol: SuiStakeProtocol
    exchangeRate?: string
  }): Promise<any | null> {
    // if (params.swapSuiAmount.lessThan(1000000000)) {
    //   throw Error('HaedalStakeSuiAmountError')
    // }
    const remainSuiLimit = params.inputSuiAmount.mul(params.remainRate)
    const remainSui = params.inputSuiAmount.sub(params.swapSuiAmount)
    let exchangeRate
    if (params.shouldRequestStake) {
      exchangeRate = await this.getExchangeRateForStake(
        params.stakeProtocol,
        params.shouldRequestStake,
        Number(params.swapSuiAmount.toFixed(0))
      )
    } else {
      exchangeRate = params.exchangeRate
        ? params.exchangeRate
        : await this.getExchangeRateForStake(params.stakeProtocol, params.shouldRequestStake, Number(params.swapSuiAmount.toFixed(0)))
    }
    // const exchangeRate =  params.exchangeRate
    //   ? params.exchangeRate
    //   : await this.getExchangeRateForStake(params.stakeProtocol, params.shouldRequestStake, Number(params.swapSuiAmount.toFixed(0)))
    const hasuiAmount = params.swapSuiAmount.div(exchangeRate).toFixed(0, Decimal.ROUND_DOWN)

    const liquidityInput = ClmmPoolUtil.estLiquidityAndcoinAmountFromOneAmounts(
      params.lowerTick,
      params.upperTick,
      new BN(hasuiAmount.toString()),
      !params.fixCoinA,
      true,
      0,
      new BN(params.curSqrtPrice)
    )
    const useSuiAmount = params.fixCoinA ? liquidityInput.coinAmountA.toString() : liquidityInput.coinAmountB.toString()
    const actRemainSui = d(remainSui).sub(useSuiAmount)

    if (
      (actRemainSui.greaterThanOrEqualTo(0) && actRemainSui.lessThanOrEqualTo(remainSuiLimit)) ||
      params.rebalanceCount > 12 ||
      params.leftSuiAmount.greaterThanOrEqualTo(params.rightSuiAmount)
    ) {
      return {
        swapInAmount: params.swapSuiAmount.toFixed(0),
        swapOutAmount: hasuiAmount,
        afterSqrtPrice: params.curSqrtPrice,
        fixAmountA: !params.fixCoinA,
        is_exceed: true,
        request_id: '',
        stake_protocol: params.stakeProtocol,
      }
    }
    if (actRemainSui.lessThan(0)) {
      return await this.calculateStakeDepositFixSui({
        ...params,
        rightSuiAmount: params.swapSuiAmount,
        swapSuiAmount: params.swapSuiAmount.add(params.leftSuiAmount).div(2),
        exchangeRate,
        rebalanceCount: params.rebalanceCount + 1,
      })
    }

    if (actRemainSui.greaterThan(remainSuiLimit)) {
      return await this.calculateStakeDepositFixSui({
        ...params,
        leftSuiAmount: params.swapSuiAmount,
        swapSuiAmount: params.swapSuiAmount.add(params.rightSuiAmount).div(2),
        exchangeRate,
        rebalanceCount: params.rebalanceCount + 1,
      })
    }

    return null
  }

  /**
   * Get the exchange rate of haSUI:SUI
   * @param shouldRequestStake  When it is true, simulation calculations are performed through the pledge logic.
   * @returns
   */
  async getExchangeRateForStake(stakingProtocol: SuiStakeProtocol, shouldRequestStake: boolean, swapAmount?: number): Promise<string> {
    if (stakingProtocol === SuiStakeProtocol.Haedal) {
      return await HaedalUtils.getExchangeRateForStake(this._sdk, shouldRequestStake, swapAmount)
    }
    if (stakingProtocol === SuiStakeProtocol.Volo) {
      return await VoloUtils.getExchangeRateForStake(this._sdk, shouldRequestStake, swapAmount)
    }
    if (stakingProtocol === SuiStakeProtocol.Aftermath) {
      return await AftermathoUtils.getExchangeRateForStake(this._sdk, shouldRequestStake, swapAmount)
    }
    return '0'
  }

  public async findRouters(
    clmm_pool: string,
    curSqrtPrice: string,
    coinTypeA: string,
    coinTypeB: string,
    amount: Decimal,
    byAmountIn: boolean,
    pools: string[],
    liquidityChanges?: PreSwapLpChangeParams,
    forceRefresh = false
  ) {
    const { aggregator } = this._sdk.sdkOptions
    const cacheKey = `${aggregator.walletAddress}_getAggregatorClient`
    const cacheClient = this.getCache(cacheKey, forceRefresh)
    let client: any
    if (cacheClient !== undefined) {
      client = cacheClient
    } else {
      const suiClient = new SuiClient({
        url: this.sdk.sdkOptions.fullRpcUrl,
      })
      client = new AggregatorClient(aggregator.endPoint, aggregator.walletAddress, suiClient, aggregator.env)
    }
    try {
      const findRouterParams: FindRouterParams = {
        from: coinTypeA,
        target: coinTypeB,
        amount: new BN(amount.toFixed(0).toString()),
        byAmountIn,
        depth: 3,
        providers: aggregator.providers,
      }
      if (liquidityChanges && liquidityChanges.poolID) {
        findRouterParams.liquidityChanges = [liquidityChanges]
      }
      const res = await client.findRouters(findRouterParams)
      if (res?.error?.code === 10001) {
        return {
          ...res,
          is_exceed: res.insufficientLiquidity,
        }
      }
      if (res?.insufficientLiquidity) {
        return {
          ...res,
          is_exceed: res.insufficientLiquidity,
        }
      }
      if (!res?.routes || res?.routes?.length === 0) {
        throw Error('Aggregator no router')
      }

      let after_sqrt_price = curSqrtPrice
      res.routes.forEach((splitPath: any) => {
        const basePath: any = splitPath.path.find((basePath: any) => basePath.id.toLowerCase() === clmm_pool.toLowerCase())
        if (basePath && basePath.extendedDetails && basePath.extendedDetails.afterSqrtPrice) {
          // after_sqrt_price
          after_sqrt_price = String(basePath.extendedDetails.afterSqrtPrice)
        }
      })
      return {
        amount_in: res.amountIn.toString(),
        amount_out: res.amountOut.toString(),
        is_exceed: res.insufficientLiquidity,
        after_sqrt_price,
        route_obj: res,
        byAmountIn: true,
        liquidity: liquidityChanges?.deltaLiquidity,
        originRes: res,
      }
    } catch (error) {
      try {
        if (pools) {
          const res: any = await client.swapInPools({
            from: coinTypeA,
            target: coinTypeB,
            amount: new BN(amount.toFixed(0).toString()),
            byAmountIn,
            pools,
          })

          if (res) {
            let after_sqrt_price = curSqrtPrice
            res.routeData.routes.forEach((splitPath: any) => {
              const basePath: any = splitPath.path.find((basePath: any) => basePath.id.toLowerCase() === clmm_pool.toLowerCase())
              if (basePath) {
                after_sqrt_price = String(basePath.extendedDetails.afterSqrtPrice)
              }
            })

            return {
              amount_in: res.routeData.amountIn.toString(),
              amount_out: res.routeData.amountOut.toString(),
              is_exceed: res.isExceed,
              after_sqrt_price,
              route_obj: res.routeData,
              byAmountIn: true,
              liquidity: liquidityChanges?.deltaLiquidity,
              originRes: res,
            }
          }
          return null
        }
        return null
      } catch (e) {
        return null
      }
    }
  }

  public async calculateRebalance(params: {
    clmm_pool: string
    curSqrtPrice: string
    a2b: boolean
    amount_a: Decimal
    amount_b: Decimal
    amount_left: Decimal
    amount_right: Decimal
    lowerTick: number
    upperTick: number
    tick_spacing: number
    coinTypeA: string
    coinTypeB: string
    useRoute: boolean
    priceSplitPoint: number
    remainRate: number
    maxLoopLimit: number
  }) {
    const {
      clmm_pool,
      a2b,
      curSqrtPrice,
      amount_a,
      amount_b,
      lowerTick,
      upperTick,
      amount_left,
      amount_right,
      coinTypeA,
      coinTypeB,
      useRoute,
      priceSplitPoint,
      remainRate,
      maxLoopLimit = 5,
    } = params

    const calculateRebalanceRecursively = async (left: Decimal, right: Decimal, count: number): Promise<any> => {
      const mid = left.plus(right).div(2)
      // const preRes = await this.clmmPreSwap(clmm_pool, curSqrtPrice, a2b, mid, coinTypeA, coinTypeB, true, priceSplitPoint, useRoute)
      const preRes: any = await this.findRouters(clmm_pool, curSqrtPrice, coinTypeA, coinTypeB, mid, a2b, [clmm_pool])

      if (preRes.amount_out === '0') {
        return preRes
      }

      if (!preRes.after_sqrt_price) {
        preRes.after_sqrt_price = params.curSqrtPrice
      }

      if (preRes.is_exceed) {
        right = mid
        return calculateRebalanceRecursively(left, right, count + 1)
      }

      const afterA = a2b ? amount_a.sub(preRes.amount_in) : amount_a.add(preRes.amount_out)
      const afterB = a2b ? amount_b.add(preRes.amount_out) : amount_b.sub(preRes.amount_in)

      const liquidityInput = ClmmPoolUtil.estLiquidityAndcoinAmountFromOneAmounts(
        lowerTick,
        upperTick,
        new BN(afterA.toString()),
        true,
        true,
        1,
        new BN(preRes.after_sqrt_price)
      )

      const usedA = new Decimal(liquidityInput.coinAmountA.toString())
      const usedB = new Decimal(liquidityInput.coinAmountB.toString())

      if (usedA.toString() !== afterA.toString()) {
        throw new Error('usedA does not match afterA')
      }

      if (afterB.lessThan(usedB)) {
        if (a2b) {
          left = mid
        } else {
          right = mid
        }
      } else {
        if (a2b) {
          right = mid
        } else {
          left = mid
        }
        const remainingB = afterB.sub(usedB)
        const maxRemainingB = afterB.mul(remainRate)

        if (maxRemainingB.sub(remainingB).greaterThanOrEqualTo(0) || count >= maxLoopLimit) {
          return { ...preRes, remainingB }
        }
      }
      if (left.greaterThan(right) || right.sub(left).lessThan(10)) {
        return preRes
      }
      return calculateRebalanceRecursively(left, right, count + 1)
    }
    if (amount_left.greaterThanOrEqualTo(amount_right)) {
      return calculateRebalanceRecursively(new Decimal(0), amount_left, 0)
    }
    return calculateRebalanceRecursively(amount_left, amount_right, 0)
  }

  private async calculateAmountFromBoth(params: CalculateAmountParams, roundUp: boolean): Promise<CalculateAmountResult> {
    const { vault_id, input_amount, fix_amount_a, slippage } = params
    // Get vault information
    const { vault, pool } = await this.getVaultAndPool(vault_id)

    // Extract position details
    const { position } = vault
    const lowerTick = position.tick_lower_index
    const upperTick = position.tick_upper_index

    const liquidityInput = ClmmPoolUtil.estLiquidityAndcoinAmountFromOneAmounts(
      lowerTick,
      upperTick,
      new BN(input_amount),
      fix_amount_a,
      roundUp,
      slippage,
      new BN(pool.current_sqrt_price)
    )

    const ft_amount = VaultsUtils.get_lp_amount_by_liquidity(vault, liquidityInput.liquidityAmount.toString())

    return {
      request_id: params.input_amount,
      amount_a: liquidityInput.coinAmountA.toString(),
      amount_b: liquidityInput.coinAmountB.toString(),
      amount_limit_a: liquidityInput.tokenMaxA.toString(),
      amount_limit_b: liquidityInput.tokenMaxB.toString(),
      ft_amount,
      fix_amount_a,
      side: InputType.Both,
    }
  }

  public async estLiquidityAmountFromFtAmount(params: { vault_id: string; input_ft_amount: string; slippage: number }) {
    const { vault_id, input_ft_amount, slippage } = params
    const { vault, pool } = await this.getVaultAndPool(vault_id)
    // Extract position details
    const { position } = vault
    const lowerTick = position.tick_lower_index
    const upperTick = position.tick_upper_index
    const lowerSqrtPrice = TickMath.tickIndexToSqrtPriceX64(lowerTick)
    const upperSqrtPrice = TickMath.tickIndexToSqrtPriceX64(upperTick)

    const lpTokenAmount = new BN(input_ft_amount)
    const liquidity = VaultsUtils.get_share_liquidity_by_amount(vault, lpTokenAmount.toString())
    const curSqrtPrice = new BN(pool.current_sqrt_price)

    const coinAmounts = ClmmPoolUtil.getCoinAmountFromLiquidity(new BN(liquidity), curSqrtPrice, lowerSqrtPrice, upperSqrtPrice, false)
    // const protocol_fee_amount_a = VaultsUtils.get_protocol_fee_amount(vault, coinAmounts.coinA.toString())
    // const protocol_fee_amount_b = VaultsUtils.get_protocol_fee_amount(vault, coinAmounts.coinB.toString())

    const minAmountA = d(coinAmounts.coinA.toString()).mul(d(1 - slippage))
    const minAmountB = d(coinAmounts.coinB.toString()).mul(d(1 - slippage))

    return {
      amount_a: coinAmounts.coinA.toString(),
      amount_b: coinAmounts.coinB.toString(),
      amount_limit_a: minAmountA.toFixed(0),
      amount_limit_b: minAmountB.toFixed(0),
    }
  }

  async deposit(params: DepositParams): Promise<Transaction> {
    const { vault_id } = params
    const { vault, pool } = await this.getVaultAndPool(vault_id, true)

    const result = await this.calculateDepositAmount(params, true, true)

    const tx = new Transaction()
    let primaryCoinAInputs
    let primaryCoinBInputs
    if (params.side === InputType.OneSide && result.swap_result) {
      const res = await this.handleDepositSwap(
        {
          ...result,
          coinTypeA: pool.coinTypeA,
          coinTypeB: pool.coinTypeB,
          slippage: params.slippage,
          clmm_pool: pool.poolAddress,
        },
        tx
      )
      primaryCoinAInputs = res.primaryCoinAInputs
      primaryCoinBInputs = res.primaryCoinBInputs
    }

    let { amount_a, amount_b } = result
    if (params.side === InputType.OneSide && params.fix_amount_a) {
      amount_a = d(result.amount_a).mul(d(1).sub(0.001)).toFixed(0, Decimal.ROUND_DOWN).toString()
      amount_b = d(result.amount_b).mul(d(1).sub(0.001)).toFixed(0, Decimal.ROUND_DOWN).toString()
    }

    await this.depositInternal(
      {
        coinTypeA: pool.coinTypeA,
        coinTypeB: pool.coinTypeB,
        lp_token_type: vault.lp_token_type,
        farming_pool: vault.position.pool_id,
        clmm_pool: pool.poolAddress,
        primaryCoinAInputs,
        primaryCoinBInputs,
        vault_id,
        slippage: params.slippage,
        amount_a: result.fix_amount_a ? amount_a : result.amount_limit_a,
        amount_b: result.fix_amount_a ? result.amount_limit_b : amount_b,
        fix_amount_a: result.fix_amount_a,
      },
      tx
    )
    return tx
  }

  private async handleDepositSwap(
    params: CalculateAmountResult & {
      coinTypeA: string
      coinTypeB: string
      slippage: number
      clmm_pool: string
      amount_a: string
    },
    tx: Transaction
  ) {
    const allCoinAsset = await this._sdk.getOwnerCoinAssets(this._sdk.senderAddress)
    const { clmm_pool, integrate } = this._sdk.sdkOptions
    const { swap_in_amount, a2b, sui_stake_protocol, route_obj } = params.swap_result!
    const fromCoinType = a2b ? params.coinTypeA : params.coinTypeB
    const swapCoinInputFrom = TransactionUtil.buildCoinForAmount(tx, allCoinAsset, BigInt(swap_in_amount), fromCoinType, false, true)
    const selectedUnusedAmount = BigInt(swapCoinInputFrom.tragetCoinAmount) - BigInt(swap_in_amount)

    let coinABs: TransactionArgument[] = []

    if (sui_stake_protocol !== SuiStakeProtocol.Cetus) {
      const haSuiCoin = this.requestStakeCoin(sui_stake_protocol, tx, swapCoinInputFrom.targetCoin)!
      const suiCoin = TransactionUtil.buildCoinForAmount(tx, swapCoinInputFrom.remainCoins, BigInt(0), fromCoinType, false).targetCoin
      coinABs = a2b ? [suiCoin, haSuiCoin] : [haSuiCoin, suiCoin]
    } else if (route_obj) {
      const routerParamsV2 = {
        routers: route_obj,
        inputCoin: swapCoinInputFrom.targetCoin,
        slippage: params.slippage,
        txb: tx,
        partner: params.partner,
      }

      const { aggregator } = this._sdk.sdkOptions
      const cacheKey = `${aggregator.walletAddress}_getAggregatorClient`
      const cacheClient = this.getCache(cacheKey, false)
      let client: any
      if (cacheClient !== undefined) {
        client = cacheClient
      } else {
        const suiClient = new SuiClient({
          url: this.sdk.sdkOptions.fullRpcUrl,
        })
        client = new AggregatorClient(aggregator.endPoint, aggregator.walletAddress, suiClient, aggregator.env)
      }
      const toCoin = await client.routerSwap(routerParamsV2)
      coinABs = a2b ? [swapCoinInputFrom.originalSplitedCoin, toCoin] : [toCoin, swapCoinInputFrom.originalSplitedCoin]
    } else {
      const swapCoinInputTo = TransactionUtil.buildCoinForAmount(tx, allCoinAsset, 0n, a2b ? params.coinTypeB : params.coinTypeA, false)
      const sqrtPriceLimit = SwapUtils.getDefaultSqrtPriceLimit(a2b).toString()
      coinABs = tx.moveCall({
        target: `${integrate.published_at}::${ClmmIntegrateRouterModule}::swap`,
        typeArguments: [params.coinTypeA, params.coinTypeB],
        arguments: [
          tx.object(getPackagerConfigs(clmm_pool).global_config_id),
          tx.object(params.clmm_pool),
          a2b ? swapCoinInputFrom.targetCoin : swapCoinInputTo.targetCoin,
          a2b ? swapCoinInputTo.targetCoin : swapCoinInputFrom.targetCoin,
          tx.pure.bool(a2b),
          tx.pure.bool(true),
          tx.pure.u64(swap_in_amount),
          tx.pure.u128(sqrtPriceLimit),
          tx.pure.bool(false),
          tx.object(CLOCK_ADDRESS),
        ],
      })
    }

    let primaryCoinAInputs

    let primaryCoinBInputs

    const coinAObj = coinABs[0] as TransactionObjectArgument
    const coinBObj = coinABs[1] as TransactionObjectArgument
    if (a2b) {
      const additionalRequiredAmount = BigInt(params.amount_a) - selectedUnusedAmount

      if (CoinAssist.isSuiCoin(fromCoinType)) {
        if (!route_obj) {
          tx.transferObjects([coinAObj], tx.pure.address(this._sdk.getVerifySenderAddress()))
        }
        primaryCoinAInputs = tx.splitCoins(tx.gas, [tx.pure.u64(params.amount_a)])
      } else if (additionalRequiredAmount > 0n) {
        const coinAResult = this.buildCoinInput(tx, swapCoinInputFrom.remainCoins, fromCoinType, additionalRequiredAmount, coinAObj)
        primaryCoinAInputs = coinAResult.coinInput
      } else {
        primaryCoinAInputs = coinAObj
      }
      primaryCoinBInputs = coinBObj
    } else {
      primaryCoinAInputs = coinAObj
      const additionalRequiredAmount = BigInt(params.amount_b) - selectedUnusedAmount
      if (CoinAssist.isSuiCoin(fromCoinType)) {
        if (!route_obj) {
          tx.transferObjects([coinBObj], tx.pure.address(this._sdk.getVerifySenderAddress()))
        }
        primaryCoinBInputs = tx.splitCoins(tx.gas, [tx.pure.u64(params.amount_b)])
      } else if (additionalRequiredAmount > 0n) {
        const coinBResult = this.buildCoinInput(tx, swapCoinInputFrom.remainCoins, fromCoinType, additionalRequiredAmount, coinBObj)
        primaryCoinBInputs = coinBResult.coinInput
      } else {
        primaryCoinBInputs = coinBObj
      }
    }

    return { primaryCoinAInputs, primaryCoinBInputs }
  }

  /**
   * the haSUI is just returned
   * @param tx
   * @param suiCoin
   * @returns
   */
  requestStakeCoin(stakingProtocol: SuiStakeProtocol, tx: Transaction, suiCoin: TransactionArgument) {
    if (stakingProtocol === SuiStakeProtocol.Haedal) {
      return HaedalUtils.requestStakeCoin(this._sdk, tx, suiCoin)
    }

    if (stakingProtocol === SuiStakeProtocol.Volo) {
      return VoloUtils.requestStakeCoin(this._sdk, tx, suiCoin)
    }

    if (stakingProtocol === SuiStakeProtocol.Aftermath) {
      return AftermathoUtils.requestStakeCoin(this._sdk, tx, suiCoin)
    }

    return undefined
  }

  private async depositInternal(
    params: {
      vault_id: string
      coinTypeA: string
      coinTypeB: string
      amount_a: string
      amount_b: string
      slippage: number
      fix_amount_a: boolean
      lp_token_type: string
      farming_pool: string
      clmm_pool: string
      primaryCoinAInputs?: TransactionObjectArgument
      primaryCoinBInputs?: TransactionObjectArgument
    },
    tx: Transaction
  ) {
    const { vaults, frams, clmm_pool } = this._sdk.sdkOptions
    const vaultsConfigs = getPackagerConfigs(vaults)
    const framsConfigs = getPackagerConfigs(frams)
    const clmmPoolConfigs = getPackagerConfigs(clmm_pool)

    let { primaryCoinAInputs, primaryCoinBInputs } = params

    if (primaryCoinAInputs === undefined || primaryCoinBInputs === undefined) {
      const allCoinAsset = await this._sdk.getOwnerCoinAssets(this._sdk.senderAddress)
      primaryCoinAInputs = TransactionUtil.buildAddLiquidityFixTokenCoinInput(
        tx,
        !params.fix_amount_a,
        params.amount_a,
        params.slippage,
        params.coinTypeA,
        allCoinAsset,
        false
      )?.targetCoin

      primaryCoinBInputs = TransactionUtil.buildAddLiquidityFixTokenCoinInput(
        tx,
        params.fix_amount_a,
        params.amount_b,
        params.slippage,
        params.coinTypeB,
        allCoinAsset,
        false
      )?.targetCoin
    }

    tx.moveCall({
      target: `${vaults.published_at}::${VaultsRouterModule}::deposit`,
      typeArguments: [params.coinTypeA, params.coinTypeB, params.lp_token_type],
      arguments: [
        tx.object(vaultsConfigs.vaults_manager_id),
        tx.object(params.vault_id),
        tx.object(framsConfigs.rewarder_manager_id),
        tx.object(framsConfigs.global_config_id),
        tx.object(params.farming_pool),
        tx.object(clmmPoolConfigs.global_config_id),
        tx.object(params.clmm_pool),
        primaryCoinAInputs,
        primaryCoinBInputs,
        tx.pure.u64(params.amount_a),
        tx.pure.u64(params.amount_b),
        tx.pure.bool(params.fix_amount_a),
        tx.object(CLOCK_ADDRESS),
      ],
    })
  }

  async withdraw(params: WithdrawBothParams | WithdrawOneSideParams): Promise<Transaction> {
    const isOneSide = 'is_ft_input' in params
    const { vault, pool } = await this.getVaultAndPool(params.vault_id, true)
    const tx = new Transaction()

    let burn_ft_amount
    let min_amount_a
    let min_amount_b
    let oneSideRes: CalculateRemoveAmountResult | undefined
    if (isOneSide) {
      oneSideRes = await this._sdk.Vaults.calculateWithdrawAmount({
        ...params,
        side: InputType.OneSide,
      })
      min_amount_a = oneSideRes.amount_limit_a
      min_amount_b = oneSideRes.amount_limit_b
      burn_ft_amount = params.is_ft_input ? params.input_amount : oneSideRes.burn_ft_amount
    } else {
      const { vault_id, ft_amount, slippage } = params
      burn_ft_amount = ft_amount
      const res = await this.estLiquidityAmountFromFtAmount({
        vault_id,
        input_ft_amount: ft_amount,
        slippage,
      })

      min_amount_a = res.amount_limit_a
      min_amount_b = res.amount_limit_b
    }

    const { reciveCoinA, reciveCoinB } = await this.withdrawInternal(
      {
        coinTypeA: pool.coinTypeA,
        coinTypeB: pool.coinTypeB,
        lp_token_type: vault.lp_token_type,
        farming_pool: vault.position.pool_id,
        clmm_pool: pool.poolAddress,
        min_amount_a,
        min_amount_b,
        vault_id: params.vault_id,
        ft_amount: burn_ft_amount,
      },
      tx
    )

    if (isOneSide && oneSideRes) {
      const { a2b, swap_in_amount, route_obj } = oneSideRes.swap_result!
      if (route_obj) {
        const swapCoinInputFrom: BuildCoinResult = {
          targetCoin: a2b ? reciveCoinA : reciveCoinB,
          remainCoins: [],
          isMintZeroCoin: false,
          tragetCoinAmount: '',
        }

        const routerParamsV2 = {
          routers: route_obj,
          inputCoin: swapCoinInputFrom.targetCoin,
          slippage: params.slippage,
          txb: tx,
          partner: params.partner,
        }
        const { aggregator } = this._sdk.sdkOptions
        const cacheKey = `${aggregator.walletAddress}_getAggregatorClient`
        const cacheClient = this.getCache(cacheKey, false)
        let client: any
        if (cacheClient !== undefined) {
          client = cacheClient
        } else {
          const suiClient = new SuiClient({
            url: this.sdk.sdkOptions.fullRpcUrl,
          })
          client = new AggregatorClient(aggregator.endPoint, aggregator.walletAddress, suiClient, aggregator.env)
        }

        const toCoin = await client.routerSwap(routerParamsV2)
        const coinABs = a2b ? [swapCoinInputFrom.targetCoin, toCoin] : [toCoin, swapCoinInputFrom.targetCoin]

        if (a2b) {
          tx.mergeCoins(coinABs[1], [reciveCoinB])
        } else {
          tx.mergeCoins(coinABs[0], [reciveCoinA])
        }
        tx.transferObjects([toCoin], tx.pure.address(this._sdk.getVerifySenderAddress()))
      } else {
        const { clmm_pool, integrate } = this._sdk.sdkOptions
        const sqrtPriceLimit = SwapUtils.getDefaultSqrtPriceLimit(a2b).toString()
        const coinABs: TransactionObjectArgument[] = tx.moveCall({
          target: `${integrate.published_at}::${ClmmIntegrateRouterModule}::swap`,
          typeArguments: [pool.coinTypeA, pool.coinTypeB],
          arguments: [
            tx.object(getPackagerConfigs(clmm_pool).global_config_id),
            tx.object(pool.poolAddress),
            reciveCoinA,
            reciveCoinB,
            tx.pure.bool(a2b),
            tx.pure.bool(true),
            tx.pure.u64(swap_in_amount),
            tx.pure.u128(sqrtPriceLimit),
            tx.pure.bool(true),
            tx.object(CLOCK_ADDRESS),
          ],
        })
        tx.transferObjects([coinABs[0], coinABs[1]], tx.pure.address(this._sdk.senderAddress))
      }
    } else {
      tx.transferObjects([reciveCoinA, reciveCoinB], tx.pure.address(this._sdk.senderAddress))
    }
    return tx
  }

  private async withdrawInternal(
    params: {
      vault_id: string
      farming_pool: string
      clmm_pool: string
      coinTypeA: string
      coinTypeB: string
      ft_amount: string
      min_amount_a: string
      min_amount_b: string
      lp_token_type: string
      primaryCoinInputs?: TransactionObjectArgument
    },
    tx: Transaction
  ): Promise<{ reciveCoinA: TransactionObjectArgument; reciveCoinB: TransactionObjectArgument }> {
    const { vaults, frams, clmm_pool } = this._sdk.sdkOptions
    const vaultsConfigs = getPackagerConfigs(vaults)
    const framsConfigs = getPackagerConfigs(frams)
    const clmmPoolConfigs = getPackagerConfigs(clmm_pool)

    let { primaryCoinInputs } = params

    if (primaryCoinInputs === undefined) {
      const allCoinAsset = await this._sdk.getOwnerCoinAssets(this._sdk.senderAddress, params.lp_token_type)
      primaryCoinInputs = TransactionUtil.buildCoinForAmount(
        tx,
        allCoinAsset,
        BigInt(params.ft_amount),
        params.lp_token_type,
        false,
        true
      ).targetCoin
    }

    const typeArguments = [params.coinTypeA, params.coinTypeB, params.lp_token_type]

    const removeCoinABs: TransactionObjectArgument[] = tx.moveCall({
      target: `${vaults.published_at}::${VaultsVaultModule}::remove`,
      typeArguments,
      arguments: [
        tx.object(vaultsConfigs.vaults_manager_id),
        tx.object(params.vault_id),
        tx.object(framsConfigs.rewarder_manager_id),
        tx.object(framsConfigs.global_config_id),
        tx.object(params.farming_pool),
        tx.object(clmmPoolConfigs.global_config_id),
        tx.object(params.clmm_pool),
        primaryCoinInputs,
        tx.pure.u64(params.ft_amount),
        tx.pure.u64(params.min_amount_a),
        tx.pure.u64(params.min_amount_b),
        tx.object(CLOCK_ADDRESS),
      ],
    })
    tx.transferObjects([primaryCoinInputs], tx.pure.address(this._sdk.senderAddress))
    return {
      reciveCoinA: removeCoinABs[0],
      reciveCoinB: removeCoinABs[1],
    }
  }

  private async getVaultAndPool(vaultId: string, refreshPool = false) {
    // Get vault information
    const vault = await this.sdk.Vaults.getVault(vaultId)

    if (vault === undefined) {
      throw new Error(`please check config and vault id`)
    }

    // Get pool information
    const pool = await this._sdk.Pool.getPool(vault.pool_id, refreshPool)

    return {
      vault,
      pool,
    }
  }

  /**
   * Retrieve a list of Vaults.
   * This function allows users to retrieve a list of Vaults with optional pagination.
   * @param paginationArgs Pagination arguments for retrieving a specific page or 'all' for all Vaults.
   * @returns A Promise that resolves to a DataPage containing the list of Vaults.
   */
  async getVaultList(paginationArgs: PaginationArgs = 'all'): Promise<DataPage<Vault>> {
    // const res = await this._sdk.fullClient.queryEventsByPage({ MoveEventType: `${vaults.package_id}::vaults::CreateEvent` }, paginationArgs)
    const { vaults_pool_handle } = getPackagerConfigs(this._sdk.sdkOptions.vaults)
    const res: any = await this._sdk.fullClient.getDynamicFields({ parentId: vaults_pool_handle })
    const warpIds = res.data.map((item: any) => item.name.value)

    const objectList = await this._sdk.fullClient.batchGetObjects(warpIds, {
      showType: true,
      showContent: true,
      showDisplay: true,
      showOwner: true,
    })

    const poolList: Vault[] = []
    objectList.forEach((item) => {
      const pool = VaultsUtils.buildPool(item)
      if (pool) {
        pool.stake_protocol = this.findStakeProtocol(pool.position.coinTypeA, pool.position.coinTypeB)
        this.savePoolToCache(pool)
        poolList.push(pool)
      }
    })

    res.data = poolList
    return res
  }

  public findStakeProtocol(coinTypeA: string, coinTypeB: string): SuiStakeProtocol | undefined {
    const { haedal, volo, aftermath } = getPackagerConfigs(this._sdk.sdkOptions.vaults)

    const coinTypeAFormat = extractStructTagFromType(coinTypeA).full_address
    const coinTypeBFormat = extractStructTagFromType(coinTypeB).full_address

    if (!(CoinAssist.isSuiCoin(coinTypeAFormat) || CoinAssist.isSuiCoin(coinTypeBFormat))) {
      return undefined
    }

    if (haedal) {
      const coinType = extractStructTagFromType(getPackagerConfigs(haedal).coin_type).full_address
      if (coinTypeAFormat === coinType || coinTypeBFormat === coinType) {
        return SuiStakeProtocol.Haedal
      }
    }

    if (volo) {
      const coinType = extractStructTagFromType(getPackagerConfigs(volo).coin_type).full_address
      if (coinTypeAFormat === coinType || coinTypeBFormat === coinType) {
        return SuiStakeProtocol.Volo
      }
    }

    if (aftermath) {
      const coinType = extractStructTagFromType(getPackagerConfigs(aftermath).coin_type).full_address
      if (coinTypeAFormat === coinType || coinTypeBFormat === coinType) {
        return SuiStakeProtocol.Aftermath
      }
    }

    return undefined
  }

  /**
   * Retrieve a specific Vault by its ID.
   * This function allows users to retrieve a specific Vault by providing its ID.
   * @param id The ID of the Vault to retrieve.
   * @param forceRefresh Whether to force a refresh of the data from the server.
   * @returns A Promise that resolves to the retrieved Vault, or undefined if the Vault is not found.
   */
  async getVault(id: string, forceRefresh = false): Promise<Vault | undefined> {
    const cachePool = this.readPoolFromCache(id, forceRefresh)
    if (cachePool) {
      return cachePool
    }
    try {
      const item: any = await this._sdk.fullClient.getObject({
        id,
        options: { showType: true, showContent: true, showDisplay: true, showOwner: true },
      })
      const pool = VaultsUtils.buildPool(item)
      if (pool) {
        this.savePoolToCache(pool)
        return pool
      }
    } catch (error) {
      console.log(error)
    }
    return undefined
  }

  private savePoolToCache(pool: Vault) {
    const cacheKey = `${pool.id}_mirrorPool`
    this.updateCache(cacheKey, pool, cacheTime24h)
  }

  private readPoolFromCache(id: string, forceRefresh = false) {
    const cacheKey = `${id}_mirrorPool`
    return this.getCache<Vault>(cacheKey, forceRefresh)
  }

  public findSuiStakeProtocol(coinTypeA: string, coinTypeB: string, fixAmountA: boolean): SuiStakeProtocol {
    const { haedal, volo, aftermath } = getPackagerConfigs(this._sdk.sdkOptions.vaults)

    const coinTypeAFormat = extractStructTagFromType(coinTypeA).full_address
    const coinTypeBFormat = extractStructTagFromType(coinTypeB).full_address

    if ((CoinAssist.isSuiCoin(coinTypeAFormat) && fixAmountA) || (CoinAssist.isSuiCoin(coinTypeBFormat) && !fixAmountA)) {
      if (haedal) {
        const coinType = extractStructTagFromType(getPackagerConfigs(haedal).coin_type).full_address
        if (coinTypeAFormat === coinType || coinTypeBFormat === coinType) {
          return SuiStakeProtocol.Haedal
        }
      }

      if (volo) {
        const coinType = extractStructTagFromType(getPackagerConfigs(volo).coin_type).full_address
        if (coinTypeAFormat === coinType || coinTypeBFormat === coinType) {
          return SuiStakeProtocol.Volo
        }
      }

      if (aftermath) {
        const coinType = extractStructTagFromType(getPackagerConfigs(aftermath).coin_type).full_address
        if (coinTypeAFormat === coinType || coinTypeBFormat === coinType) {
          return SuiStakeProtocol.Aftermath
        }
      }
    }

    return SuiStakeProtocol.Cetus
  }

  public getOwnerVaultsBalance = async (walletAddress: any) => {
    const { data } = await this.getVaultList()
    const result = []
    for (let i = 0; i < data.length; i++) {
      const vault = data[i]
      const lp_token_balance = await this._sdk.fullClient.getBalance({
        owner: walletAddress,
        coinType: vault.lp_token_type,
      })
      const clmmPool = await this._sdk.Pool.getPool(vault.pool_id, true)
      const liquidity = VaultsUtils.get_share_liquidity_by_amount(vault, lp_token_balance.totalBalance)
      const { tick_lower_index, tick_upper_index, coinTypeA, coinTypeB } = vault.position
      const lowerSqrtPrice = TickMath.tickIndexToSqrtPriceX64(tick_lower_index)
      const upperSqrtPrice = TickMath.tickIndexToSqrtPriceX64(tick_upper_index)
      const amountInfo = ClmmPoolUtil.getCoinAmountFromLiquidity(
        new BN(liquidity),
        new BN(clmmPool.current_sqrt_price),
        lowerSqrtPrice,
        upperSqrtPrice,
        true
      )
      result.push({
        vault_id: data[i].id,
        clmm_pool_id: vault.pool_id,
        owner: walletAddress,
        lp_token_type: vault.lp_token_type,
        lp_token_balance: lp_token_balance.totalBalance,
        liquidity,
        tick_lower_index,
        tick_upper_index,
        amount_a: amountInfo.coinA.toString(),
        amount_b: amountInfo.coinB.toString(),
        coin_type_a: coinTypeA,
        coin_type_b: coinTypeB,
      })
    }
    return result
  }

  private buildCoinInput(tx: Transaction, coinAssets: CoinAsset[], coinType: string, amount: bigint, appendCoin?: any) {
    const { selectedCoins, remainingCoins } = CoinAssist.selectCoinAssetGreaterThanOrEqual(coinAssets, BigInt(amount))
    const selectAmountTotal = CoinAssist.calculateTotalBalance(selectedCoins)
    if (selectAmountTotal < BigInt(amount)) {
      throw new Error(`The amount(${selectAmountTotal}) is Insufficient balance for ${coinType} , expect ${amount} `)
    }
    const selectedUnusedAmount = selectAmountTotal - BigInt(amount)
    let coinInput
    if (CoinAssist.isSuiCoin(coinType)) {
      coinInput = tx.splitCoins(tx.gas, [tx.pure.u64(amount)])
    } else {
      const [primaryCoinA, ...mergeCoinAs] = selectedCoins.map((item) => item.coinObjectId)
      coinInput = tx.object(primaryCoinA)
      if (mergeCoinAs.length > 0) {
        if (appendCoin) {
          tx.mergeCoins(coinInput, [...mergeCoinAs.map((coin) => tx.object(coin)), appendCoin])
        } else {
          tx.mergeCoins(coinInput, [...mergeCoinAs.map((coin) => tx.object(coin))])
        }
      } else if (appendCoin) {
        tx.mergeCoins(coinInput, [appendCoin])
      }
    }

    return {
      selectedUnusedAmount,
      coinInput,
      remainingCoins,
    }
  }

  async getVaultsConfigs(forceRefresh = false): Promise<VaultsConfigs> {
    const { package_id } = this._sdk.sdkOptions.vaults
    const cacheKey = `${package_id}_getMirrorPoolConfigs`
    const cacheData = this.getCache<VaultsConfigs>(cacheKey, forceRefresh)
    if (cacheData !== undefined) {
      return cacheData
    }

    const objects = (
      await this._sdk.fullClient.queryEventsByPage({
        MoveEventType: `${package_id}::vaults::InitEvent`,
      })
    ).data

    const config: VaultsConfigs = {
      admin_cap_id: '',
      vaults_manager_id: '',
      vaults_pool_handle: '',
    }

    if (objects.length > 0) {
      // eslint-disable-next-line no-unreachable-loop
      for (const item of objects) {
        const fields = item.parsedJson as any
        config.admin_cap_id = fields.admin_cap_id
        config.vaults_manager_id = fields.manager_id

        const masterObj = await this._sdk.fullClient.getObject({ id: config.vaults_manager_id, options: { showContent: true } })
        const masterFields = getObjectFields(masterObj)
        config.vaults_pool_handle = masterFields.vault_to_pool_maps.fields.id.id
        break
      }
      this.updateCache(cacheKey, config, cacheTime24h)
    }

    return config
  }

  private updateCache(key: string, data: any, time = cacheTime24h) {
    let cacheData = this._cache[key]
    if (cacheData) {
      cacheData.overdueTime = getFutureTime(time)
      cacheData.value = data
    } else {
      cacheData = new CachedContent(data, getFutureTime(time))
    }
    this._cache[key] = cacheData
  }

  private getCache<T>(key: string, forceRefresh = false): T | undefined {
    const cacheData = this._cache[key]
    if (!forceRefresh && cacheData?.isValid()) {
      return cacheData.value as T
    }
    delete this._cache[key]
    return undefined
  }
}
