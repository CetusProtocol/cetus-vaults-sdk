import { getFullnodeUrl } from '@mysten/sui/client'
import { Env } from '@cetusprotocol/aggregator-sdk'
import CetusVaultsSDK, { SdkOptions } from '../main'

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
    vaults_pool_handle: '0x9036bcc5aa7fd2cceec1659a6a1082871f45bc400c743f50063363457d1738bd',
    haedal: {
      package_id: '0xac2afb455cbcdc2ff1a2e9bbb8aa4ccb4506a544b08c740886892a5cdf92f472',
      published_at: '0x9dac9c5770e5f930d2223ff68782958701acfaee9337e8d8363978ce7670dffb',
      version: 1,
      config: {
        staking_id: '0x6e384d2da5b040b27f973155e25bbe4beb0ad5ca8ee0a36e20dff356094c9fc0',
        coin_type: '0xac2afb455cbcdc2ff1a2e9bbb8aa4ccb4506a544b08c740886892a5cdf92f472::hasui::HASUI',
      },
    },
    aftermath: {
      package_id: '0x5e8c0fc2b3d8aa1b06eec36c08d9d835c73c0626a1efaebc0fb03aa52f1a3ff4',
      published_at: '0x5e8c0fc2b3d8aa1b06eec36c08d9d835c73c0626a1efaebc0fb03aa52f1a3ff4',
      version: 1,
      config: {
        staked_sui_vault: '0xe498a8c07ec62200c519a0092eda233abdab879e8f332c11bdc1819eb7b12fbb',
        referral_vault: '0x8d357115058f22976cd01c5415116d9aca806d1ded37eecd75d87978f404e927',
        safe: '0x38710a6e0bd885c158e52ec7a42c8a9a1826c6696b626b4a5e2d1dcb15cfd9b7',
        validator_address: '0x9336c4c9d891e263cfac99adc397853a7392e5cf84cbd5df92207a57c7fbdadc',
        coin_type: '0x5e8c0fc2b3d8aa1b06eec36c08d9d835c73c0626a1efaebc0fb03aa52f1a3ff4::afsui::AFSUI',
      },
    },
  },
  framsConfig: {
    global_config_id: '0x499132a4baf342a0fe9528a3666a77b2aece3be129f4a3ada469fef4b9c34fb4',
    rewarder_manager_id: '0x960c7800e301fd1e47b79037927b426db57b643bd2934f7069d81c2dae092230',
    rewarder_manager_handle: '0x1274149371876b60742cd02071a09f2aa72ffee75b76fdfc45724d98f18ea5b5',
    admin_cap_id: '0x110175e641c1ea8f9287f4fd59cb6a1fb97a3f3ec595aa30d0e6ed93ac4caa0c',
  },
}

export const clmmTestnet: SdkOptions = {
  fullRpcUrl: getFullnodeUrl('testnet'),
  simulationAccount: {
    address: '0x0000000000000000000000000000000000000000000000000000000000000000',
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
/**
 * Initialize the testnet SDK
 * @param fullNodeUrl. If provided, it will be used as the full node URL.
 * @param simulationAccount. If provided, it will be used as the simulation account address.
 * @returns
 */
export function initTestnetSDK(fullNodeUrl?: string, simulationAccount?: string): CetusVaultsSDK {
  if (fullNodeUrl) {
    clmmTestnet.fullRpcUrl = fullNodeUrl
  }
  if (simulationAccount) {
    clmmTestnet.simulationAccount.address = simulationAccount
  }
  return new CetusVaultsSDK(clmmTestnet)
}
