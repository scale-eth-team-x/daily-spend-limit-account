import { utils, Wallet, Provider, Contract, EIP712Signer, types } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const ETH_ADDRESS = "0x000000000000000000000000000000000000800A";
const ACCOUNT_ADDRESS = "0x450558EbA6Ed9B3a6D6847462cb991489ABf713A";

const PRIVATE_KEY: string = process.env.ZKS_PRIVATE_KEY || "";
if (!PRIVATE_KEY) {
  throw new Error("Please set ZKS_PRIVATE_KEY in the environment variables.");
}

export default async function (hre: HardhatRuntimeEnvironment) {
  const provider = new Provider("https://zksync2-testnet.zksync.dev");
  const wallet = new Wallet(PRIVATE_KEY, provider);
  const owner1 = new Wallet("0x6f842fb8656fb2311a9e9e6a62126f25fe0fd56ede5d338200a7ed5f54d48696");
  const owner2 = new Wallet("0x236949b919816c077a90125f96220791756fa963b7d4c316282dd0500158eb27");

  const accountArtifact = await hre.artifacts.readArtifact("TwoUserMultisig");
  const account = new Contract(ACCOUNT_ADDRESS, accountArtifact.abi, wallet);

  let ethTransferTx = {
    from: ACCOUNT_ADDRESS,
    to: wallet.address,
    chainId: (await provider.getNetwork()).chainId,
    nonce: await provider.getTransactionCount(ACCOUNT_ADDRESS),
    type: 113,
    customData: {
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    } as types.Eip712Meta,
    value: ethers.utils.parseEther("0.0049"), // 0.0051 fails but 0.0049 succeeds
    data: "0x",
    gasPrice: await provider.getGasPrice(),
    gasLimit: ethers.BigNumber.from(20000000)
  };

  const signedTxHash = EIP712Signer.getSignedDigest(ethTransferTx);
  const signature = ethers.utils.concat([
    // Note, that `signMessage` wouldn't work here, since we don't want
    // the signed hash to be prefixed with `\x19Ethereum Signed Message:\n`
    ethers.utils.joinSignature(owner1._signingKey().signDigest(signedTxHash)),
    ethers.utils.joinSignature(owner2._signingKey().signDigest(signedTxHash)),
  ]);

  ethTransferTx.customData = {
    ...ethTransferTx.customData,
    customSignature: signature,
  };

  const sentTx = await provider.sendTransaction(utils.serialize(ethTransferTx));
  console.log("sentTx: ", sentTx.hash);
}
