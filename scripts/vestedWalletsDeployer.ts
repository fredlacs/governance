import { Signer } from "ethers";
import {
  ArbitrumVestingWalletsFactory__factory,
  L2ArbitrumToken__factory,
} from "../typechain-types";
import { WalletCreatedEvent } from "../typechain-types/src/ArbitrumVestingWalletFactory.sol/ArbitrumVestingWalletsFactory";
import { Recipients } from "./testUtils";

export const deployVestedWallets = async (
  deployer: Signer,
  tokenHolder: Signer,
  tokenAddress: string,
  recipients: Recipients,
  startTimeSeconds: number,
  durationSeconds: number
) => {
  const token = L2ArbitrumToken__factory.connect(tokenAddress, tokenHolder);

  const vestedWalletFactoryFac = new ArbitrumVestingWalletsFactory__factory(deployer);
  const vestedWalletFactory = await vestedWalletFactoryFac.deploy();
  await vestedWalletFactory.deployed();

  const recipientAddresses = Object.keys(recipients);
  const batchSize = 5;

  for (let index = 0; index < recipientAddresses.length; index = index + batchSize) {
    const recipientBatch = recipientAddresses.slice(index, batchSize);

    const walletCreationReceipt = await (
      await vestedWalletFactory.createWallets(startTimeSeconds, durationSeconds, recipientBatch)
    ).wait();

    const walletPairs = walletCreationReceipt.logs
      .map(
        (l) =>
          ArbitrumVestingWalletsFactory__factory.createInterface().parseLog(l)
            .args as WalletCreatedEvent["args"]
      )
      .map((w) => ({
        beneficiary: w.beneficiary,
        wallet: w.vestingWalletAddress,
      }));

    for (const walletPair of walletPairs) {
      const amount = recipients[walletPair.beneficiary.toLowerCase()];

      if (!amount.gt(0)) {
        throw new Error(`Missing amount for ${walletPair.beneficiary}`);
      }

      await (await token.transfer(walletPair.wallet, amount)).wait();
    }
  }

  return vestedWalletFactory;
};
