import { getFullnodeUrl } from '@mysten/sui/client'
import { Env } from '@cetusprotocol/aggregator-sdk'
import { CetusVaultsSDK, SdkOptions } from '../sdk'

const SDKConfig = {
  clmmConfig: {
    pools_id: '0xf699e7f2276f5c9a75944b37a0c5b5d9ddfd2471bf6242483b03ab2887d198d0',
    admin_cap_id: '0x89c1a321291d15ddae5a086c9abc533dff697fde3d89e0ca836c41af73e36a75',
    global_config_id: '0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f',
    global_vault_id: '0xce7bceef26d3ad1f6d9b6f13a953f053e6ed3ca77907516481ce99ae8e588f2b',
  },
  framsConfig: {
    global_config_id: '0x21215f2f6de04b57dd87d9be7bb4e15499aec935e36078e2488f36436d64996e',
    rewarder_manager_id: '0xe0e155a88c77025056da08db5b1701a91b79edb6167462f768e387c3ed6614d5',
    rewarder_manager_handle: '0xb32e312cbb3367d6f3d2b4e57c9225e903d29b7b9f612dae2ddf75bdeb26a5aa',
    admin_cap_id: '0xf10fbf1fea5b7aeaa524b87769461a28c5c977613046360093673991f26d886c',
  },
  vaultConfig: {
    admin_cap_id: '0x78a42978709c4032fab7b33b782b5bcef64c1c6603250bf23644650b72144375',
    vaults_manager_id: '0x25b82dd2f5ee486ed1c8af144b89a8931cd9c29dee3a86a1bfe194fdea9d04a6',
    vaults_pool_handle: '0x9036bcc5aa7fd2cceec1659a6a1082871f45bc400c743f50063363457d1738bd',
    haedal: {
      package_id: '0xbde4ba4c2e274a60ce15c1cfff9e5c42e41654ac8b6d906a57efa4bd3c29f47d',
      published_at: '0xaabf0856070391df81fad9240049d69c5a51c3d376cc0885eeedd516526cc79b',
      version: 1,
      config: {
        staking_id: '0x47b224762220393057ebf4f70501b6e657c3e56684737568439a04f80849b2ca',
        coin_type: '0xbde4ba4c2e274a60ce15c1cfff9e5c42e41654ac8b6d906a57efa4bd3c29f47d::hasui::HASUI',
      },
    },
    volo: {
      package_id: '0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55',
      published_at: '0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55',
      version: 1,
      config: {
        native_pool: '0x7fa2faa111b8c65bea48a23049bfd81ca8f971a262d981dcd9a17c3825cb5baf',
        vsui_metadata: '0x680cd26af32b2bde8d3361e804c53ec1d1cfe24c7f039eb7f549e8dfde389a60',
        coin_type: '0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55::cert::CERT',
      },
    },
    aftermath: {
      package_id: '0x7f6ce7ade63857c4fd16ef7783fed2dfc4d7fb7e40615abdb653030b76aef0c6',
      published_at: '0x7f6ce7ade63857c4fd16ef7783fed2dfc4d7fb7e40615abdb653030b76aef0c6',
      version: 1,
      config: {
        staked_sui_vault: '0x2f8f6d5da7f13ea37daa397724280483ed062769813b6f31e9788e59cc88994d',
        referral_vault: '0x4ce9a19b594599536c53edb25d22532f82f18038dc8ef618afd00fbbfb9845ef',
        safe: '0xeb685899830dd5837b47007809c76d91a098d52aabbf61e8ac467c59e5cc4610',
        validator_address: '0xd30018ec3f5ff1a3c75656abf927a87d7f0529e6dc89c7ddd1bd27ecb05e3db2',
        coin_type: '0xf325ce1300e8dac124071d3152c5c5ee6174914f8bc2161e88329cf579246efc::afsui::AFSUI',
      },
    },
  },
}

export const clmmMainnet: SdkOptions = {
  fullRpcUrl: getFullnodeUrl('mainnet'),
  simulationAccount: {
    address: '0x0000000000000000000000000000000000000000000000000000000000000000',
  },
  clmm_pool: {
    package_id: '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb',
    published_at: '0x70968826ad1b4ba895753f634b0aea68d0672908ca1075a2abdf0fc9e0b2fc6a',
    version: 4,
    config: SDKConfig.clmmConfig,
  },
  integrate: {
    package_id: '0x996c4d9480708fb8b92aa7acf819fb0497b5ec8e65ba06601cae2fb6db3312c3',
    published_at: '0x8faab90228e4c4df91c41626bbaefa19fc25c514405ac64de54578dec9e6f5ee',
    version: 2,
  },
  vaults: {
    package_id: '0xd3453d9be7e35efe222f78a810bb3af1859fd1600926afced8b4936d825c9a05',
    published_at: '0xabbd278f738affe762e9df4765b3409bb1e86a355a4f611ad82b278c18108918',
    version: 1,
    config: SDKConfig.vaultConfig,
  },
  frams: {
    package_id: '0x11ea791d82b5742cc8cab0bf7946035c97d9001d7c3803a93f119753da66f526',
    published_at: '0x11ea791d82b5742cc8cab0bf7946035c97d9001d7c3803a93f119753da66f526',
    version: 1,
    config: SDKConfig.framsConfig,
  },
  aggregator: {
    endPoint: 'https://api-sui-cloudfront.cetus.zone/router_v2/find_routes',
    fullNodeurl: 'https://fullnode.mainnet.sui.io:443',
    walletAddress: '0xfba94aa36e93ccc7d84a6a57040fc51983223f1b522a8d0be3c3bf2c98977ebb',
    env: Env.Mainnet,
    providers: ['CETUS', 'DEEPBOOK', 'KRIYA', 'KRIYAV3', 'FLOWX', 'FLOWXV3', 'AFTERMATH', 'TURBOS', 'HAEDAL', 'VOLO', 'AFSUI'],
    pythUrls: [],
  },
}

/**
 * Initialize the mainnet SDK
 * @param fullNodeUrl. If provided, it will be used as the full node URL.
 * @param simulationAccount. If provided, it will be used as the simulation account address.
 * @returns
 */
export function initMainnetSDK(fullNodeUrl?: string, simulationAccount?: string): CetusVaultsSDK {
  if (fullNodeUrl) {
    clmmMainnet.fullRpcUrl = fullNodeUrl
  }
  if (simulationAccount) {
    clmmMainnet.simulationAccount.address = simulationAccount
  }
  return new CetusVaultsSDK(clmmMainnet)
}
