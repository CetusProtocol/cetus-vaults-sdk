import { TransactionArgument, Transaction } from '@mysten/sui/transactions'
import { d, getPackagerConfigs } from '@cetusprotocol/cetus-sui-clmm-sdk'
import { bcs } from '@mysten/sui/bcs'
import { normalizeSuiObjectId } from '@mysten/sui/utils'
import { CetusVaultsSDK } from '../sdk'
import { VaultsUtils } from './vaults'

export class HaedalUtils {
  public static async getExchangeRateForStake(sdk: CetusVaultsSDK, shouldRequestStake: boolean, swapAmount?: number): Promise<string> {
    const { vaults } = sdk.sdkOptions
    const { haedal } = getPackagerConfigs(vaults)
    if (haedal === undefined) {
      throw Error('the haedal config is undefined')
    }
    const { simulationAccount } = sdk.sdkOptions
    const { staking_id } = getPackagerConfigs(haedal)
    try {
      const tx = new Transaction()
      if (shouldRequestStake) {
        await this.requestStake(sdk, swapAmount || 1000000000, tx)
      } else {
        tx.moveCall({
          target: `${haedal.published_at}::staking::get_exchange_rate`,
          typeArguments: [],
          arguments: [tx.object(staking_id)],
        })
      }

      const res: any = await sdk.fullClient.devInspectTransactionBlock({
        transactionBlock: tx,
        sender: shouldRequestStake ? sdk.senderAddress : simulationAccount.address,
      })

      if (shouldRequestStake) {
        const findItem = res.events.find((item: any) => {
          return item.type.includes('UserStaked')
        })
        const { sui_amount, st_amount } = findItem.parsedJson
        const rate = d(sui_amount).div(st_amount).toString()
        return rate
      }
      const returnValues = res.results[0]!.returnValues[0][0]
      const rate = d(bcs.u64().parse(Uint8Array.from(returnValues))).div(1000000)
      return rate.toString()
    } catch (error) {
      console.log('getExchangeRateForHaedal', error)
    }
    return '0'
  }

  static async requestStake(sdk: CetusVaultsSDK, amount: number, tx?: Transaction) {
    const { vaults } = sdk.sdkOptions
    tx = tx || new Transaction()

    const suiCoin = await VaultsUtils.getSuiCoin(sdk, amount, tx)

    tx.moveCall({
      target: `${vaults.config?.haedal?.published_at}::interface::request_stake`,
      typeArguments: [],
      arguments: [
        tx.object(normalizeSuiObjectId('0x5')),
        tx.object(vaults.config!.haedal!.config!.staking_id!),
        suiCoin,
        tx.pure.address(normalizeSuiObjectId('0x0')),
      ],
    })
    return tx
  }

  static requestStakeCoin(sdk: CetusVaultsSDK, tx: Transaction, suiCoin: TransactionArgument) {
    const { haedal } = sdk.sdkOptions.vaults.config!
    const haSuiCoin = tx.moveCall({
      target: `${haedal!.published_at}::staking::request_stake_coin`,
      typeArguments: [],
      arguments: [
        tx.object(normalizeSuiObjectId('0x5')),
        tx.object(haedal!.config!.staking_id),
        suiCoin,
        tx.pure.address(normalizeSuiObjectId('0x0')),
      ],
    })
    return haSuiCoin
  }
}
