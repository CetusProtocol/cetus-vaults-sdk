import { Env } from '@cetusprotocol/aggregator-sdk'
import CetusClmmSDK, { SdkOptions } from '../../src'
import { getFullnodeUrl } from '@mysten/sui/client'

const SDKConfig = {
  clmmConfig: {
    pools_id: '0x50eb61dd5928cec5ea04711a2e9b72e5237e79e9fbcd2ce3d5469dc8708e0ee2',
    global_config_id: '0x9774e359588ead122af1c7e7f64e14ade261cfeecdb5d0eb4a5b3b4c8ab8bd3e',
    global_vault_id: '0xf78d2ee3c312f298882cb680695e5e8c81b1d441a646caccc058006c2851ddea',
    admin_cap_id: '0xd0accadc3d0b27f0cfaebe8e546968ac7874b9a9f5964669b4c9a7e1dcf80a28',
  },
  vaultConfig: {
    admin_cap_id: '0x78a42978709c4032fab7b33b782b5bcef64c1c6603250bf23644650b72144375',
    vaults_manager_id: '0x25b82dd2f5ee486ed1c8af144b89a8931cd9c29dee3a86a1bfe194fdea9d04a6',
    vaults_pool_handle: '0x9036bcc5aa7fd2cceec1659a6a1082871f45bc400c743f50063363457d1738bd'
  },
  framsConfig: {
    global_config_id: '0x499132a4baf342a0fe9528a3666a77b2aece3be129f4a3ada469fef4b9c34fb4',
    rewarder_manager_id: '0x960c7800e301fd1e47b79037927b426db57b643bd2934f7069d81c2dae092230',
    rewarder_manager_handle: '0x1274149371876b60742cd02071a09f2aa72ffee75b76fdfc45724d98f18ea5b5',
    admin_cap_id: '0x110175e641c1ea8f9287f4fd59cb6a1fb97a3f3ec595aa30d0e6ed93ac4caa0c'
  },
  
}

export const clmm_testnet: SdkOptions = {
  fullRpcUrl: getFullnodeUrl('testnet'),
  simulationAccount: {
    address: '0xcd0247d0b67e53dde69b285e7a748e3dc390e8a5244eb9dd9c5c53d95e4cf0aa',
  },
  clmm_pool: {
    package_id: '0x0c7ae833c220aa73a3643a0d508afa4ac5d50d97312ea4584e35f9eb21b9df12',
    published_at: '0x0c7ae833c220aa73a3643a0d508afa4ac5d50d97312ea4584e35f9eb21b9df12',
    version: 6,
    config: SDKConfig.clmmConfig,
  },
  integrate: {
    package_id: '0x2918cf39850de6d5d94d8196dc878c8c722cd79db659318e00bff57fbb4e2ede',
    published_at: '0x2918cf39850de6d5d94d8196dc878c8c722cd79db659318e00bff57fbb4e2ede',
    version: 6,
  },
  vaults: {
    package_id: '0x325b7d67276ff809df6b3fa17a2a6fbff6aaa20e467c3cf74d1a1d09b8890bbd',
    published_at: '0x325b7d67276ff809df6b3fa17a2a6fbff6aaa20e467c3cf74d1a1d09b8890bbd',
    version: 1,
    config: SDKConfig.vaultConfig,
  },
  frams: {
    package_id: '0xcc38686ca84d1dca949b6966dcdb66b698b58a4bba247d8db4d6a3a1dbeca26e',
    published_at: '0xcc38686ca84d1dca949b6966dcdb66b698b58a4bba247d8db4d6a3a1dbeca26e',
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
