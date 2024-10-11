import { SuiObjectResponse, SuiTransactionBlockResponse } from '@mysten/sui/client'
import {
  buildPool,
  CachedContent,
  cacheTime24h,
  cacheTime5min,
  extractStructTagFromType,
  getFutureTime,
  Pool,
  PoolImmutables,
  SuiResource,
} from '@cetusprotocol/cetus-sui-clmm-sdk'
import { IModule } from '../interfaces/IModule'
import { ClmmpoolsError, PoolErrorCode } from '../errors/errors'
import { CetusVaultsSDK } from '../sdk'

/**
 * Helper class to help interact with clmm pools with a pool router interface.
 */
export class PoolModule implements IModule {
  protected _sdk: CetusVaultsSDK

  private readonly _cache: Record<string, CachedContent> = {}

  constructor(sdk: CetusVaultsSDK) {
    this._sdk = sdk
  }

  get sdk() {
    return this._sdk
  }

  /**
   * Gets a list of pool immutables.
   * @param {string[]} assignPoolIDs An array of pool IDs to get.
   * @param {number} offset The offset to start at.
   * @param {number} limit The number of pools to get.
   * @param {boolean} forceRefresh Whether to force a refresh of the cache.
   * @returns {Promise<PoolImmutables[]>} array of PoolImmutable objects.
   */
  async getPoolImmutables(assignPoolIDs: string[] = [], offset = 0, limit = 100, forceRefresh = false): Promise<PoolImmutables[]> {
    const { package_id } = this._sdk.sdkOptions.clmm_pool
    const cacheKey = `${package_id}_getInitPoolEvent`
    const cacheData = this.getCache<PoolImmutables[]>(cacheKey, forceRefresh)

    const allPools: PoolImmutables[] = []
    const filterPools: PoolImmutables[] = []

    if (cacheData !== undefined) {
      allPools.push(...cacheData)
    }

    if (allPools.length === 0) {
      try {
        const objects = await this._sdk.fullClient.queryEventsByPage({ MoveEventType: `${package_id}::factory::CreatePoolEvent` })

        objects.data.forEach((object: any) => {
          const fields = object.parsedJson
          if (fields) {
            allPools.push({
              poolAddress: fields.pool_id,
              tickSpacing: fields.tick_spacing,
              coinTypeA: extractStructTagFromType(fields.coin_type_a).full_address,
              coinTypeB: extractStructTagFromType(fields.coin_type_b).full_address,
            })
          }
        })
        this.updateCache(cacheKey, allPools, cacheTime24h)
      } catch (error) {
        console.log('getPoolImmutables', error)
      }
    }

    const hasAssignPools = assignPoolIDs.length > 0
    for (let index = 0; index < allPools.length; index += 1) {
      const item = allPools[index]
      if (hasAssignPools && !assignPoolIDs.includes(item.poolAddress)) continue
      if (!hasAssignPools && (index < offset || index >= offset + limit)) continue
      filterPools.push(item)
    }
    return filterPools
  }

  /**
   * Gets a list of pools.
   * @param {string[]} assignPools An array of pool IDs to get.
   * @param {number} offset The offset to start at.
   * @param {number} limit The number of pools to get.
   * @returns {Promise<Pool[]>} array of Pool objects.
   */
  async getPools(assignPools: string[] = [], offset = 0, limit = 100): Promise<Pool[]> {
    const allPool: Pool[] = []
    let poolObjectIds: string[] = []

    if (assignPools.length > 0) {
      poolObjectIds = [...assignPools]
    } else {
      const poolImmutables = await this.getPoolImmutables([], offset, limit, false)
      poolImmutables.forEach((item) => poolObjectIds.push(item.poolAddress))
    }

    const objectDataResponses = await this._sdk.fullClient.batchGetObjects(poolObjectIds, {
      showContent: true,
      showType: true,
    })

    for (const suiObj of objectDataResponses) {
      if (suiObj.error != null || suiObj.data?.content?.dataType !== 'moveObject') {
        throw new ClmmpoolsError(
          `getPools error code: ${suiObj.error?.code ?? 'unknown error'}, please check config and object ids`,
          PoolErrorCode.InvalidPoolObject
        )
      }

      const pool = buildPool(suiObj)
      allPool.push(pool)
      const cacheKey = `${pool.poolAddress}_getPoolObject`
      this.updateCache(cacheKey, pool, cacheTime24h)
    }
    return allPool
  }

  /**
   * Gets a pool by its object ID.
   * @param {string} poolID The object ID of the pool to get.
   * @param {true} forceRefresh Whether to force a refresh of the cache.
   * @returns {Promise<Pool>} A promise that resolves to a Pool object.
   */
  async getPool(poolID: string, forceRefresh = true): Promise<Pool> {
    const cacheKey = `${poolID}_getPoolObject`
    const cacheData = this.getCache<Pool>(cacheKey, forceRefresh)
    if (cacheData !== undefined) {
      return cacheData
    }
    const object = (await this._sdk.fullClient.getObject({
      id: poolID,
      options: {
        showType: true,
        showContent: true,
      },
    })) as SuiObjectResponse

    if (object.error != null || object.data?.content?.dataType !== 'moveObject') {
      throw new ClmmpoolsError(
        `getPool error code: ${object.error?.code ?? 'unknown error'}, please check config and object id`,
        PoolErrorCode.InvalidPoolObject
      )
    }
    const pool = buildPool(object)
    this.updateCache(cacheKey, pool)
    return pool
  }

  /**
   * Gets the SUI transaction response for a given transaction digest.
   * @param digest - The digest of the transaction for which the SUI transaction response is requested.
   * @param forceRefresh - A boolean flag indicating whether to force a refresh of the response.
   * @returns A Promise that resolves with the SUI transaction block response or null if the response is not available.
   */
  async getSuiTransactionResponse(digest: string, forceRefresh = false): Promise<SuiTransactionBlockResponse | null> {
    const cacheKey = `${digest}_getSuiTransactionResponse`
    const cacheData = this.getCache<SuiTransactionBlockResponse>(cacheKey, forceRefresh)

    if (cacheData !== undefined) {
      return cacheData
    }
    let objects
    try {
      objects = (await this._sdk.fullClient.getTransactionBlock({
        digest,
        options: {
          showEvents: true,
          showEffects: true,
          showBalanceChanges: true,
          showInput: true,
          showObjectChanges: true,
        },
      })) as SuiTransactionBlockResponse
    } catch (error) {
      objects = (await this._sdk.fullClient.getTransactionBlock({
        digest,
        options: {
          showEvents: true,
          showEffects: true,
        },
      })) as SuiTransactionBlockResponse
    }

    this.updateCache(cacheKey, objects, cacheTime24h)
    return objects
  }

  /**
   * Updates the cache for the given key.
   * @param key The key of the cache entry to update.
   * @param data The data to store in the cache.
   * @param time The time in minutes after which the cache entry should expire.
   */
  updateCache(key: string, data: SuiResource, time = cacheTime5min) {
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
