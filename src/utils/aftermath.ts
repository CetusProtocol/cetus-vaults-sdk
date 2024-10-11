import { TransactionArgument, Transaction } from '@mysten/sui/transactions'
import { d, getPackagerConfigs } from '@cetusprotocol/cetus-sui-clmm-sdk'
import { bcs } from '@mysten/sui/bcs'
import { normalizeSuiObjectId } from '@mysten/sui/utils'
import { CetusVaultsSDK } from '../sdk'
import { VaultsUtils } from './vaults'

export class AftermathoUtils {
  public static async getExchangeRateForStake(sdk: CetusVaultsSDK, shouldRequestStake: boolean, swapAmount?: number): Promise<string> {
    const { vaults } = sdk.sdkOptions
    const { aftermath } = getPackagerConfigs(vaults)
    if (aftermath === undefined) {
      throw Error('the aftermath config is undefined')
    }
    const { simulationAccount } = sdk.sdkOptions
    const { staked_sui_vault, safe } = getPackagerConfigs(aftermath)
    try {
      const tx = new Transaction()
      if (shouldRequestStake) {
        await this.requestStake(sdk, swapAmount || 1000000000, tx)
      } else {
        tx.moveCall({
          target: `${aftermath.published_at}::staked_sui_vault::afsui_to_sui_exchange_rate`,
          typeArguments: [],
          arguments: [tx.object(staked_sui_vault), tx.object(safe)],
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
        const { afsui_amount, sui_amount } = findItem.parsedJson
        return d(sui_amount).div(afsui_amount).toString()
      }

      const returnValues = res.results[0]!.returnValues[0][0]
      const rate = d(bcs.u128().parse(Uint8Array.from(returnValues))).div(1000000000000000000)

      return rate.toString()
    } catch (error) {
      console.log('getExchangeRateForHaedal', error)
    }
    return '0'
  }

  static async requestStake(sdk: CetusVaultsSDK, amount: number, tx?: Transaction) {
    const { vaults } = sdk.sdkOptions

    const { aftermath } = getPackagerConfigs(vaults)
    if (aftermath === undefined) {
      throw Error('the aftermath config is undefined')
    }

    tx = tx || new Transaction()
    const { staked_sui_vault, referral_vault, safe, validator_address } = getPackagerConfigs(aftermath)

    const suiCoin = await VaultsUtils.getSuiCoin(sdk, amount, tx)
    // https://github.com/AftermathFinance/move-interfaces/blob/main/packages/afsui/afsui-staked-sui-vault/sources/staked_sui_vault.move

    tx.moveCall({
      target: `${aftermath.published_at}::staked_sui_vault::request_stake_and_keep`,
      typeArguments: [],
      arguments: [
        tx.object(staked_sui_vault),
        tx.object(safe),
        tx.object(normalizeSuiObjectId('0x5')),
        tx.object(referral_vault),
        suiCoin,
        tx.pure.address(normalizeSuiObjectId(validator_address)),
      ],
    })
    return tx
  }

  static requestStakeCoin(sdk: CetusVaultsSDK, tx: Transaction, suiCoin: TransactionArgument) {
    const { vaults } = sdk.sdkOptions
    const { aftermath } = getPackagerConfigs(vaults)
    if (aftermath === undefined) {
      throw Error('the aftermath config is undefined')
    }

    tx = tx || new Transaction()
    const { staked_sui_vault, referral_vault, safe, validator_address } = getPackagerConfigs(aftermath)
    const haSuiCoin = tx.moveCall({
      target: `${aftermath.published_at}::staked_sui_vault::request_stake`,
      typeArguments: [],
      arguments: [
        tx.object(staked_sui_vault),
        tx.object(safe),
        tx.object(normalizeSuiObjectId('0x5')),
        tx.object(referral_vault),
        suiCoin,
        tx.pure.address(normalizeSuiObjectId(validator_address)),
      ],
    })
    return haSuiCoin
  }
}
