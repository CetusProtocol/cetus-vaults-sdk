## Vaults Docs

Vaults is a system specifically designed to automatically manage user liquidity. It encompasses the timely reinvestment
of fees and rewards, as well as rebalancing when necessary.

Vaults possesses the Farms WrappedPositionNFT. When a user deposits tokens into Vaults, those tokens are utilized to
provide liquidity within the positions held by Vaults.

As tokens are added to the respective positions, LP (Liquidity Provider) tokens are minted and allocated to users.

These LP tokens serve as a representation of the individual's share of liquidity within Vaults.

## Vault SDK - TS

Github Link: https://github.com/CetusProtocol/cetus-vaults-sdk

NPM Link: [@cetusprotocol/vaults-sdk](https://www.npmjs.com/package/@cetusprotocol/vaults-sdk)

### 1. Initializing the SDK
Initialize the SDK with the necessary configuration parameters. Typically, this involves setting up the network and API keys if required:
- **Mainnet**: 

```typescript
const MainnetSDK = initCetusVaultsSDK({ env: 'mainnet'})
```

- **Testnet**: 

```typescript
const TestnetSDK = initCetusVaultsSDK({ env: 'testnet'})
```

### 2. Set Wallet Address
After linking the wallet, the wallet address must be set in the SDK:
 ```typescript
sdk.senderAddress = '0x..'
```

### 3. Find all vaults by owner address.

```
const owner = '0x...'
const vaultsResult = await sdk.Vaults.getOwnerVaultsBalance(owner)

// result
[
    {
        vault_id: '0x5732b81e659bd2db47a5b55755743dde15be99490a39717abc80d62ec812bcb6',
        clmm_pool_id: '0x6c545e78638c8c1db7a48b282bb8ca79da107993fcb185f75cedc1f5adb2f535',
        owner: '0x...',
        lp_token_type: '0xb490d6fa9ead588a9d72da07a02914da42f6b5b1339b8118a90011a42b67a44f::lp_token::LP_TOKEN',
        lp_token_balance: '739242144247',
        liquidity: '799210772591',
        tick_lower_index: 100,
        tick_upper_index: 394,
        amount_a: '5514867803',
        amount_b: '6197505499',
        coin_type_a: '0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55::cert::CERT',
        coin_type_b: '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI'
    },
    {
        vault_id: '0xff4cc0af0ad9d50d4a3264dfaafd534437d8b66c8ebe9f92b4c39d898d6870a3',
        clmm_pool_id: '0xa528b26eae41bcfca488a9feaa3dca614b2a1d9b9b5c78c256918ced051d4c50',
        owner: '0x...',
        lp_token_type: '0x0c8a5fcbe32b9fc88fe1d758d33dd32586143998f68656f43f3a6ced95ea4dc3::lp_token::LP_TOKEN',
        lp_token_balance: '0',
        liquidity: '0',
        tick_lower_index: 100,
        tick_upper_index: 394,
        amount_a: '0',
        amount_b: '0',
        coin_type_a: '0xf325ce1300e8dac124071d3152c5c5ee6174914f8bc2161e88329cf579246efc::afsui::AFSUI',
        coin_type_b: '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI'
    },
    {
        vault_id: '0xde97452e63505df696440f86f0b805263d8659b77b8c316739106009d514c270',
        clmm_pool_id: '0x871d8a227114f375170f149f7e9d45be822dd003eba225e83c05ac80828596bc',
        owner: '0x...',
        lp_token_type: '0x828b452d2aa239d48e4120c24f4a59f451b8cd8ac76706129f4ac3bd78ac8809::lp_token::LP_TOKEN',
        lp_token_balance: '892508867879',
        liquidity: '563072189415',
        tick_lower_index: 200,
        tick_upper_index: 488,
        amount_a: '3439040327',
        amount_b: '4659999185',
        coin_type_a: '0xbde4ba4c2e274a60ce15c1cfff9e5c42e41654ac8b6d906a57efa4bd3c29f47d::hasui::HASUI',
        coin_type_b: '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI'
    }
]

```

### 4. Get vault by vault id

```
const vault = await sdk.Vaults.getVault(vaultId)
```

### 5. Get vault asset

```
const ftAsset = await sdk.getOwnerCoinBalances(sdk.senderAddress, vault?.lp_token_type)

```

### 6. Deposit

Deposit Liquidity into vaults，User deposit coinA and coinB into vaults, and the associated LP Token will mint to user

```

const input_amount = toDecimalsAmount(3, 9).toString()

/**
 * @param {Object} params - The parameters for the deposit function.
 * @param {string} params.vault_id - The ID of the vault.
 * @param {number} params.slippage - The slippage percentage.
 * @param {string} params.deposit_result - The amount of coin A.
 * @param {Object} [params.swap_result] - The result of the calculateDepositAmount.
 * @param {Object} [params.coin_object_a] - Optional. The coin object for coin A. If provided, it will be used.
 * @param {Object} [params.coin_object_b] - Optional. The coin object for coin B. If provided, it will be used.
 * @param {boolean} [params.return_lp_token] - Optional. If set to true, returns the LP coin. The user needs to handle it. 
 */
const result = await sdk.Vaults.calculateDepositAmount({
    vault_id: vaultId,
    fix_amount_a: false,
    input_amount,
    slippage: 0.01,
    side: InputType.OneSide,
})
console.log({ result })

const tx = new Transaction()
const params: DepositParams = {
    vault_id: vaultId,
    slippage: 0.01,
    deposit_result: result,
    return_lp_token: true,
}

const lp_coin = await sdk.Vaults.deposit(params, tx)

if (lp_coin) {
  tx.transferObjects([lp_coin], sdk.senderAddress)
}
```


### 7. Withdraw

Withdraw Liquidity from vaults，User withdraw coinA and coinB from vaults, and the associated LP Token will be burned

```
/**
 * @param {Object} params - The parameters for the calculateWithdrawAmount function.
 * @param {string} params.vault_id - The ID of the vault.
 * @param {boolean} params.fix_amount_a - Whether to fix the amount of token A. If true, the input_amount represents token A amount; if false, it represents token B amount.
 * @param {string} params.input_amount - The input amount. If is_ft_input is true, this is the LP token amount; if false, this is the token amount (either A or B based on fix_amount_a).
 * @param {number} params.slippage - The slippage percentage (eg: 0.01 = 1%)
 * @param {boolean} params.is_ft_input - Whether the input is LP token. If true, input_amount is LP token amount; if false, input_amount is token amount.
 * @param {InputType} params.side - The withdrawal type. Both for withdrawing both tokens, OneSide for withdrawing a single token.
 * @param {string} params.max_ft_amount - The amount of LP tokens held by the user. In OneSide mode, this value is used to balance the withdrawal amount.
 */
const result = await sdk.Vaults.calculateWithdrawAmount({
    vault_id: vaultId,
    fix_amount_a: true,
    input_amount: '1000000000',
    slippage: 0.01,
    is_ft_input: false,
    side: InputType.Both,
    max_ft_amount: '',
})

/**
 * @param {Object} params - The parameters for the withdraw function.
 * @param {string} params.vault_id - The ID of the vault.
 * @param {number} params.slippage - The slippage percentage (0-1).
 * @param {string} params.ft_amount - The amount of LP tokens to burn.
 */
const payload = await sdk.Vaults.withdraw({
    vault_id: vaultId,
    slippage: 0.01,
    ft_amount: result.burn_ft_amount,
})
const txResult = await sdk.fullClient.sendTransaction(sendKeypair, payload)
```