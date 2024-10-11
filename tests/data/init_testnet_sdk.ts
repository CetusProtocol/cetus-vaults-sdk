import { Env } from '@cetusprotocol/aggregator-sdk'
import CetusClmmSDK, { SdkOptions } from '../../src'

const SDKConfig = {
  clmmConfig: {
    pools_id: '0xc090b101978bd6370def2666b7a31d7d07704f84e833e108a969eda86150e8cf',
    global_config_id: '0x6f4149091a5aea0e818e7243a13adcfb403842d670b9a2089de058512620687a',
    global_vault_id: '0xf3114a74d54cbe56b3e68f9306661c043ede8c6615f0351b0c3a93ce895e1699',
    admin_cap_id: '0xa456f86a53fc31e1243f065738ff1fc93f5a62cc080ff894a0fb3747556a799b',
  },
  vaultConfig: {
    admin_cap_id: '0x9b2d6f5be2650d16d27cd630c4539a76d7793970343ed3cbb023e13f1637c07c',
    vaults_manager_id: '0xc0a1a937df08880e395d85014ff40c74f13abe7a53abdbffea36f51adaaaf79e',
    vaults_pool_handle: '0x3ab02203de753de9c8198cc0ce7594dc960878f2c34c5c5a4b7742082241860a'
  },
  framsConfig: {
    global_config_id: '0x5082c7a5ee9a758025d7b0a5e8aa08b56625c7cd535b8909d2b7993991e229cc',
    rewarder_manager_id: '0xe789e092dbd9dceadbe89350c4761a6f2e11647aab97f09746a01b151926cc0e',
    rewarder_manager_handle: '0x7e7dd42392b5d82564dc9ad5093a111c5f0598cc9f806cff257d7dacb71f7837',
    admin_cap_id: '0x4ec248bca2d1fc05f39fd7491ab490464a46d128624caa4d3c2a66d957ef40b0'
  },
  
}

export const clmm_testnet: SdkOptions = {
  fullRpcUrl: 'https://sui-testnet-endpoint.blockvision.org',
  simulationAccount: {
    address: '0xcd0247d0b67e53dde69b285e7a748e3dc390e8a5244eb9dd9c5c53d95e4cf0aa',
  },
  clmm_pool: {
    package_id: '0x0868b71c0cba55bf0faf6c40df8c179c67a4d0ba0e79965b68b3d72d7dfbf666',
    published_at: '0x1c29d658882c40eeb39a8bb8fe58f71a216a918acb3e3eb3b47d24efd07257f2',
    version: 6,
    config: SDKConfig.clmmConfig,
  },
  integrate: {
    package_id: '0x8627c5cdcd8b63bc3daa09a6ab7ed81a829a90cafce6003ae13372d611fbb1a9',
    published_at: '0xf1a5d0c5b0593e41d13f9684ca91365bdfe54a98836c1d33c90e361a031fac74',
    version: 6,
  },
  vaults: {
    package_id: '0x25cff94bdb454bae6a5565d09047bfe2b230025ef3bd2199622ec48d854b86b9',
    published_at: '0x25cff94bdb454bae6a5565d09047bfe2b230025ef3bd2199622ec48d854b86b9',
    version: 1,
    config: SDKConfig.vaultConfig,
  },
  frams: {
    package_id: '0xfa0d98e99c1dbdbea1b0fe089fa93ebab40a7719ae4160c42cc78ebfe029fda0',
    published_at: '0xfa0d98e99c1dbdbea1b0fe089fa93ebab40a7719ae4160c42cc78ebfe029fda0',
    version: 1,
    config: SDKConfig.framsConfig,
  },
  aggregator: {
    endPoint: 'https://api-sui-cloudfront.cetus.zone/router_v2/find_routes',
    fullNodeurl: 'https://fullnode.mainnet.sui.io:443',
    walletAddress: '0xfba94aa36e93ccc7d84a6a57040fc51983223f1b522a8d0be3c3bf2c98977ebb',
    env: Env.Mainnet,
    providers: ['CETUS', 'DEEPBOOK', 'KRIYA', 'KRIYAV3', 'FLOWX', 'FLOWXV3', 'AFTERMATH', 'TURBOS', 'HAEDAL', 'VOLO', 'AFSUI'],
  },
}

export const TestnetSDK = new CetusClmmSDK(clmm_testnet)
