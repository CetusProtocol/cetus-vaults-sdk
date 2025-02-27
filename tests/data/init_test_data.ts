import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { SDK } from './init_mainnet_sdk'
import { TestnetSDK } from './init_testnet_sdk'
import { CetusVaultsSDK } from '../../src/sdk'
import dotenv from 'dotenv';

const envConfig = dotenv.config();
console.log('🚀🚀🚀 ~ file: init_test_data.ts:8 ~ dotenv.config():', dotenv.config())
export enum SdkEnv {
  mainnet = 'mainnet',
  testnet = 'testnet',
}
export let currSdkEnv = SdkEnv.testnet

export function buildSdk(sdkEnv: SdkEnv = currSdkEnv): CetusVaultsSDK {
  currSdkEnv = sdkEnv
  switch (currSdkEnv) {
    case SdkEnv.mainnet:
      return SDK
    case SdkEnv.testnet:
      return TestnetSDK
    default:
      throw Error('not match SdkEnv')
  }
}


export function buildTestAccount(): Ed25519Keypair {
  // Please enter your test account secret or mnemonics
  const testAccountObject = Ed25519Keypair.deriveKeypair(envConfig?.parsed?.WALLET_KEY ||'')
  console.log(' Address: ', testAccountObject.getPublicKey().toSuiAddress())
  return testAccountObject
}


