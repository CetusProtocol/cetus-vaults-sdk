import { ClmmPoolUtil, printTransaction, TickMath } from '@cetusprotocol/cetus-sui-clmm-sdk'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import 'isomorphic-fetch'
import { DepositParams, InputType } from '../src/types/vaults'
import { SdkEnv, buildSdk, buildTestAccount } from './data/init_test_data'
import Decimal from 'decimal.js'
import { initCetusVaultsSDK } from '../src/config/config'
import BN from 'bn.js'

const vaultId = '0xde97452e63505df696440f86f0b805263d8659b77b8c316739106009d514c270'

describe('vaults router', () => {
  const sdk = initCetusVaultsSDK({
    network: 'mainnet',
  })
  let sendKeypair: Ed25519Keypair

  beforeEach(async () => {
    sendKeypair = buildTestAccount()
    sdk.senderAddress = sendKeypair.getPublicKey().toSuiAddress()
  })

  test('VaultsConfigs', async () => {
    try {
      const initFactoryEvent = await sdk.Vaults.getVaultsConfigs()
      console.log({
        ...initFactoryEvent,
      })
    } catch (error) {
      console.log(error)
    }
  })

  test('1 getVaultList', async () => {
    const dataPage = await sdk.Vaults.getVaultList()
    console.log('dataPage: ', dataPage.data)
  })

  test('2 getOwnerCoinBalances', async () => {
    const vault = await sdk.Vaults.getVault(vaultId)
    console.log('vault: ', vault)

    const ftAsset = await sdk.getOwnerCoinBalances(sdk.senderAddress, vault?.lp_token_type)
    console.log('ftAsset: ', ftAsset)
  })

  test('2 getVault', async () => {
    const vault = await sdk.Vaults.getVault(vaultId)
    console.log('vault: ', vault)
  })

  test('1  calculate both amount', async () => {
    const result = await sdk.Vaults.calculateDepositAmount({
      vault_id: vaultId,
      fix_amount_a: false,
      input_amount: '1000000000',
      slippage: 0.01,
      side: InputType.Both,
    })
    console.log({ result })
  })

  test('2 calculate one side amount fix_amount_a true', async () => {
    const result = await sdk.Vaults.calculateDepositAmount({
      vault_id: vaultId,
      fix_amount_a: true,
      input_amount: '1000000000',
      slippage: 0.01,
      side: InputType.OneSide,
    })
    console.log({ result })
  })

  test('3 calculate one side amount fix_amount_a false', async () => {
    const result = await sdk.Vaults.calculateDepositAmount({
      vault_id: vaultId,
      fix_amount_a: false,
      input_amount: '10000000',
      slippage: 0.01,
      side: InputType.OneSide,
    })
    console.log({ result })
  })

  test('1 both side deposit', async () => {
    const params: DepositParams = {
      vault_id: vaultId,
      fix_amount_a: false,
      input_amount: '10000000',
      slippage: 0.01,
      side: InputType.Both,
    }
    const paylod = await sdk.Vaults.deposit(params)
    printTransaction(paylod)
    // const txResult = await sdk.fullClient.sendTransaction(sendKeypair, paylod)
    // console.log('deposit: ', txResult)
    console.log('🚀🚀🚀 ~ file: vaults_deposit_aftermath.test.ts:168 ~ test ~ sdk.ClmmSDK.senderAddress:', sdk.senderAddress)
    const res = await sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: paylod,
      sender: sdk.senderAddress,
    })
    // console.log('1110 res: ', res.events.length > 0 ? res.events : res)
  })

  test('2 one side deposit fix_amount_a true', async () => {
    const input_amount = new Decimal(5).mul(Decimal.pow(10, 9)).toString()
    const params: DepositParams = {
      vault_id: vaultId,
      fix_amount_a: false,
      input_amount: input_amount,
      slippage: 0.01,
      side: InputType.OneSide,
    }
    const paylod = await sdk.Vaults.deposit(params)
    printTransaction(paylod)
    // const txResult = await sdk.fullClient.sendTransaction(sendKeypair, paylod)
    // console.log('deposit: ', txResult)
    const res = await sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: paylod,
      sender: sdk.senderAddress,
    })
    console.log('1110 res: ', res.events.length > 0 ? res.events : res)
  })

  test('3 one side deposit fix_amount_a false', async () => {
    const params: DepositParams = {
      vault_id: vaultId,
      fix_amount_a: true,
      input_amount: '1000000',
      slippage: 0.01,
      side: InputType.OneSide,
    }
    const paylod = await sdk.Vaults.deposit(params)
    printTransaction(paylod)
    const res = await sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: paylod,
      sender: sdk.senderAddress,
    })
    console.log('1110 res: ', res.events.length > 0 ? res.events : res)
    // const txResult = await sdk.fullClient.sendTransaction(sendKeypair, paylod)
    // console.log('deposit: ', txResult)
  })

  test('1 calculate both side withdraw amount by fix coin', async () => {
    const result = await sdk.Vaults.calculateWithdrawAmount({
      vault_id: vaultId,
      fix_amount_a: true,
      input_amount: '1000000000',
      slippage: 0.01,
      is_ft_input: false,
      side: InputType.Both,
      max_ft_amount: '',
    })

    console.log({ result })
  })

  test('2 calculate both side withdraw amount by ft_input', async () => {
    const result = await sdk.Vaults.calculateWithdrawAmount({
      vault_id: vaultId,
      fix_amount_a: true,
      input_amount: '315689081',
      slippage: 0.01,
      is_ft_input: true,
      side: InputType.Both,
      max_ft_amount: '',
    })
    console.log({ result })
  })

  test('1 both side withdraw amount by inputAmount fix coin fix_amount_a true', async () => {
    const result = await sdk.Vaults.calculateWithdrawAmount({
      vault_id: vaultId,
      fix_amount_a: true,
      input_amount: '10000000',
      slippage: 0.01,
      is_ft_input: false,
      side: InputType.Both,
      max_ft_amount: '',
    })
    console.log({ result })

    const paylod = await sdk.Vaults.withdraw({
      vault_id: vaultId,
      slippage: 0.01,
      ft_amount: result.burn_ft_amount,
    })
    printTransaction(paylod)
    const txResult = await sdk.fullClient.sendTransaction(sendKeypair, paylod)
    console.log('deposit: ', txResult)
    // const res = await sdk.fullClient.devInspectTransactionBlock({
    //   transactionBlock: paylod,
    //   sender: sdk.senderAddress,
    // })
    // console.log('1110 res: ', res.events.length > 0 ? res.events : res)
  })

  test('2 one side side withdraw amount by input_amount fix coin fix_amount_a true', async () => {
    const result = await sdk.Vaults.calculateWithdrawAmount({
      vault_id: vaultId,
      fix_amount_a: true,
      input_amount: '1000000000',
      slippage: 0.1,
      is_ft_input: false,
      side: InputType.OneSide,
      max_ft_amount: '',
    })
    console.log(JSON.stringify(result))

    const paylod = await sdk.Vaults.withdraw({
      vault_id: vaultId,
      fix_amount_a: true,
      is_ft_input: false,
      slippage: 0.1,
      input_amount: '1000000000',
      max_ft_amount: '34813648675',
    })
    // printTransaction(paylod)
    // const txResult = await sdk.fullClient.sendTransaction(sendKeypair, paylod)
    // console.log('remove: ', txResult)
    const res = await sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: paylod,
      sender: sdk.senderAddress,
    })
    console.log('1110 res: ', res.events.length > 0 ? res.events : res)
  })

  test('3 one side side withdraw amount by ft_amount fix coin fix_amount_a true', async () => {
    // const result = await sdk.Vaults.calculateWithdrawAmount({
    //   vault_id: vaultId,
    //   fix_amount_a: true,
    //   input_amount: '21958602211',
    //   slippage: 0.01,
    //   is_ft_input: true,
    //   side: InputType.OneSide,
    //   max_ft_amount: '21958602211',
    // })
    // console.log(JSON.stringify(result))

    // 单token 移除部分

    const paylod = await sdk.Vaults.withdraw({
      vault_id: vaultId,
      fix_amount_a: false,
      is_ft_input: false,
      slippage: 0.01,
      input_amount: '637771460',
      max_ft_amount: '419540343722',
    })
    printTransaction(paylod)
    // const txResult = await sdk.fullClient.sendTransaction(sendKeypair, paylod)
    // console.log('remove: ', txResult)
    const res = await sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: paylod,
      sender: sdk.senderAddress,
    })
    console.log('1110 res: ', res.events.length > 0 ? res.events : res)
  })

  test('getVaultsBalance', async () => {
    const result = await sdk.Vaults.getOwnerVaultsBalance(sdk.senderAddress)
    console.log('🚀🚀🚀 ~ file: vaults_router.test.ts:241 ~ test ~ result:', result)
  })

  test('withdraw', async () => {
    const paylod = await sdk.Vaults.withdraw({
      vault_id: '0x99946ea0792c7dee40160e78b582e578f9cd613bfbaf541ffdd56487e20856bf',
      fix_amount_a: true,
      is_ft_input: true,
      slippage: 0.001,
      input_amount: '45464419062',
      max_ft_amount: '45464419062',
    })
    printTransaction(paylod)
    // const txResult = await sdk.fullClient.sendTransaction(sendKeypair, paylod)
    // console.log('remove: ', txResult)
    const res = await sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: paylod,
      sender: '0x2a6174f94a2c1d648de290297be27867527a6aaa263a4e0a567c9cd7656d3651',
    })
    console.log('1110 res: ', res.events.length > 0 ? res.events : res)
  })

  test('22222withdraw', async () => {
    const currentTick = TickMath.sqrtPriceX64ToTickIndex(new BN('18447878183175709242'))
    const lowerTick = currentTick - 250
    const upperTick = currentTick + 250

    const liquidityInput = ClmmPoolUtil.estLiquidityAndcoinAmountFromOneAmounts(
      lowerTick,
      upperTick,
      new BN(1000000000),
      true,
      true,
      0,
      new BN('18447878183175709242')
    )
    const amount_a = liquidityInput.coinAmountA.toString()
    const amount_b = liquidityInput.coinAmountB.toString()
    console.log('amount_a: ', { amount_a, amount_b, currentTick })

    const currentTick2 = TickMath.sqrtPriceX64ToTickIndex(new BN('18467878183275719242'))

    const liquidityInput2 = ClmmPoolUtil.estLiquidityAndcoinAmountFromOneAmounts(
      lowerTick,
      upperTick,
      new BN(1000000000),
      true,
      true,
      0,
      new BN('18447878183275719242')
    )
    const amount_a2 = liquidityInput2.coinAmountA.toString()
    const amount_b2 = liquidityInput2.coinAmountB.toString()
    console.log('amount_a2: ', { amount_a2, amount_b2, currentTick2 })
  })
})
