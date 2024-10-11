import { TransactionArgument, Transaction } from '@mysten/sui/transactions'
import { d, getPackagerConfigs } from '@cetusprotocol/cetus-sui-clmm-sdk'
import { bcs } from '@mysten/sui/bcs'
import { normalizeSuiObjectId } from '@mysten/sui/utils'
import { CetusVaultsSDK } from '../sdk'
import { VaultsUtils } from './vaults'

export class VoloUtils {
  public static async getExchangeRateForStake(sdk: CetusVaultsSDK, shouldRequestStake: boolean, swapAmount?: number): Promise<string> {
    const { vaults } = sdk.sdkOptions
    const { volo } = getPackagerConfigs(vaults)
    if (volo === undefined) {
      throw Error('the volo config is undefined')
    }
    const { simulationAccount } = sdk.sdkOptions
    const { native_pool, vsui_metadata } = getPackagerConfigs(volo)
    try {
      const tx = new Transaction()
      if (shouldRequestStake) {
        await this.requestStake(sdk, swapAmount || 1000000000, tx)
      } else {
        tx.moveCall({
          target: `${volo.published_at}::native_pool::get_ratio`,
          typeArguments: [],
          arguments: [tx.object(native_pool), tx.object(vsui_metadata)],
        })
      }

      const res: any = await sdk.fullClient.devInspectTransactionBlock({
        transactionBlock: tx,
        sender: shouldRequestStake ? sdk.senderAddress : simulationAccount.address,
      })

      if (shouldRequestStake) {
        const findItem = res.events.find((item: any) => {
          return item.type.includes('StakedEvent')
        })
        const { cert_amount, sui_amount } = findItem.parsedJson
        return d(sui_amount).div(cert_amount).toString()
      }
      const returnValues = res.results[0]!.returnValues[0][0]
      const rate = d(bcs.u256().parse(Uint8Array.from(returnValues)))
        .div('1000000000000000000')
        .toNumber()

      return d(1).div(rate).toString()
    } catch (error) {
      console.log('getExchangeRateForHaedal', error)
    }
    return '0'
  }

  static async requestStake(sdk: CetusVaultsSDK, amount: number, tx?: Transaction) {
    const { vaults } = sdk.sdkOptions

    const { volo } = getPackagerConfigs(vaults)
    if (volo === undefined) {
      throw Error('the volo config is undefined')
    }

    tx = tx || new Transaction()
    const { native_pool, vsui_metadata } = getPackagerConfigs(volo)

    const suiCoin = await VaultsUtils.getSuiCoin(sdk, amount, tx)
    // https://github.com/Sui-Volo/volo-liquid-staking-contracts/blob/main/liquid_staking/sources/native_pool.move#L700
    tx.moveCall({
      target: `${volo.published_at}::native_pool::stake`,
      typeArguments: [],
      arguments: [tx.object(native_pool), tx.object(vsui_metadata), tx.object(normalizeSuiObjectId('0x5')), suiCoin],
    })
    return tx
  }

  static requestStakeCoin(sdk: CetusVaultsSDK, tx: Transaction, suiCoin: TransactionArgument) {
    const { vaults } = sdk.sdkOptions
    const { volo } = getPackagerConfigs(vaults)
    if (volo === undefined) {
      throw Error('the volo config is undefined')
    }

    tx = tx || new Transaction()
    const { native_pool, vsui_metadata } = getPackagerConfigs(volo)
    const haSuiCoin = tx.moveCall({
      target: `${volo.published_at}::native_pool::stake_non_entry`,
      typeArguments: [],
      arguments: [tx.object(native_pool), tx.object(vsui_metadata), tx.object(normalizeSuiObjectId('0x5')), suiCoin],
    })
    return haSuiCoin
  }
}
