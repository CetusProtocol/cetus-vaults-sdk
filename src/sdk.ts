import { CoinBalance } from '@mysten/sui/client'
import { isValidSuiAddress } from '@mysten/sui/utils'
import {
  CachedContent,
  cacheTime24h,
  ClmmConfig,
  CoinAsset,
  extractStructTagFromType,
  getFutureTime,
  Package,
  patchFixSuiObjectId,
  SuiAddressType,
  SuiResource,
} from '@cetusprotocol/cetus-sui-clmm-sdk'
import { VaultsConfigs, FrarmsConfigs, AggregatorCoinfig } from './types'
import { PoolModule, VaultsModule } from './modules'
import { RpcModule } from './modules/rpcModule'

/**
 * Represents options and configurations for an SDK.
 */
export type SdkOptions = {
  /**
   * The full URL for interacting with the RPC (Remote Procedure Call) service.
   */
  fullRpcUrl: string

  vaults: Package<VaultsConfigs>

  frams: Package<FrarmsConfigs>

  aggregator: AggregatorCoinfig
  /**
   * Package containing Cryptocurrency Liquidity Mining Module (CLMM) pool configurations.
   */
  clmm_pool: Package<ClmmConfig>

  /**
   * Package containing integration-related configurations.
   */
  integrate: Package

  /**
   * Configuration for the simulation account.
   */
  simulationAccount: {
    /**
     * The address of the simulation account.
     */
    address: string
  }
}

/**
 * The entry class of CetusClmmSDK, which is almost responsible for all interactions with CLMM.
 */
export class CetusVaultsSDK {
  private readonly _cache: Record<string, CachedContent> = {}

  /**
   * RPC provider on the SUI chain
   */
  protected _rpcModule: RpcModule

  /**
   * Provide interact with Vaults interface.
   */
  protected _vaults: VaultsModule

  /**
   *  Provide sdk options
   */
  protected _sdkOptions: SdkOptions

  /**
   * After connecting the wallet, set the current wallet address to senderAddress.
   */
  protected _senderAddress = ''

  /**
   * Provide interact with a pool interface.
   */
  protected _pool: PoolModule

  constructor(options: SdkOptions) {
    this._sdkOptions = options
    this._rpcModule = new RpcModule({
      url: options.fullRpcUrl,
    })

    this._vaults = new VaultsModule(this)
    this._pool = new PoolModule(this)

    patchFixSuiObjectId(this._sdkOptions)
  }

  /**
   * Getter for the sender address property.
   * @returns {SuiAddressType} The sender address.
   */
  get senderAddress(): SuiAddressType {
    return this._senderAddress
  }

  /**
   * Setter for the sender address property.
   * @param {string} value - The new sender address value.
   */
  set senderAddress(value: string) {
    this._senderAddress = value
  }

  /**
   * Getter for the fullClient property.
   * @returns {RpcModule} The fullClient property value.
   */
  get fullClient(): RpcModule {
    return this._rpcModule
  }

  /**
   * Getter for the sdkOptions property.
   * @returns {SdkOptions} The sdkOptions property value.
   */
  get sdkOptions(): SdkOptions {
    return this._sdkOptions
  }

  /**
   * Getter for the Pool property.
   * @returns {PoolModule} The Pool property value.
   */
  get Vaults(): VaultsModule {
    return this._vaults
  }

  /**
   * Getter for the RouterV2 property.
   * @returns {RouterModuleV2} The RouterV2 property value.
   */
  get Pool(): PoolModule {
    return this._pool
  }

  getVerifySenderAddress() {
    if (this.senderAddress.length === 0 || !isValidSuiAddress(this.senderAddress)) {
      throw Error('this clmm config sdk senderAddess is illegal')
    }
    return this.senderAddress
  }

  /**
   * Gets all coin assets for the given owner and coin type.
   *
   * @param suiAddress The address of the owner.
   * @param coinType The type of the coin.
   * @returns an array of coin assets.
   */
  async getOwnerCoinAssets(suiAddress: string, coinType?: string | null, forceRefresh = true): Promise<CoinAsset[]> {
    const allCoinAsset: CoinAsset[] = []
    let nextCursor: string | null | undefined = null

    const cacheKey = `${this.sdkOptions.fullRpcUrl}_${suiAddress}_${coinType}_getOwnerCoinAssets`
    const cacheData = this.getCache<CoinAsset[]>(cacheKey, forceRefresh)
    if (cacheData) {
      return cacheData
    }

    while (true) {
      const allCoinObject: any = await (coinType
        ? this.fullClient.getCoins({
            owner: suiAddress,
            coinType,
            cursor: nextCursor,
          })
        : this.fullClient.getAllCoins({
            owner: suiAddress,
            cursor: nextCursor,
          }))

      allCoinObject.data.forEach((coin: any) => {
        if (BigInt(coin.balance) > 0) {
          allCoinAsset.push({
            coinAddress: extractStructTagFromType(coin.coinType).source_address,
            coinObjectId: coin.coinObjectId,
            balance: BigInt(coin.balance),
          })
        }
      })
      nextCursor = allCoinObject.nextCursor

      if (!allCoinObject.hasNextPage) {
        break
      }
    }
    this.updateCache(cacheKey, allCoinAsset, 30 * 1000)
    return allCoinAsset
  }

  /**
   * Gets all coin balances for the given owner and coin type.
   *
   * @param suiAddress The address of the owner.
   * @param coinType The type of the coin.
   * @returns an array of coin balances.
   */
  async getOwnerCoinBalances(suiAddress: string, coinType?: string | null): Promise<CoinBalance[]> {
    let allCoinBalance: CoinBalance[] = []

    if (coinType) {
      const res = await this.fullClient.getBalance({
        owner: suiAddress,
        coinType,
      })
      allCoinBalance = [res]
    } else {
      const res = await this.fullClient.getAllBalances({
        owner: suiAddress,
      })
      allCoinBalance = [...res]
    }
    return allCoinBalance
  }

  /**
   * Updates the cache for the given key.
   *
   * @param key The key of the cache entry to update.
   * @param data The data to store in the cache.
   * @param time The time in minutes after which the cache entry should expire.
   */
  updateCache(key: string, data: SuiResource, time = cacheTime24h) {
    let cacheData = this._cache[key]
    if (cacheData) {
      cacheData.overdueTime = getFutureTime(time)
      cacheData.value = data
    } else {
      cacheData = new CachedContent(data, getFutureTime(time))
    }
    this._cache[key] = cacheData
  }

  /**
   * Gets the cache entry for the given key.
   *
   * @param key The key of the cache entry to get.
   * @param forceRefresh Whether to force a refresh of the cache entry.
   * @returns The cache entry for the given key, or undefined if the cache entry does not exist or is expired.
   */
  getCache<T>(key: string, forceRefresh = false): T | undefined {
    const cacheData = this._cache[key]
    const isValid = cacheData?.isValid()
    if (!forceRefresh && isValid) {
      return cacheData.value as T
    }
    if (!isValid) {
      delete this._cache[key]
    }
    return undefined
  }
}
