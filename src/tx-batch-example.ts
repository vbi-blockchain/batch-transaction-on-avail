import { initialize, getKeyringFromSeed, getDecimals, formatNumberToBalance } from "avail-js-sdk"
import { ISubmittableResult } from "@polkadot/types/types/extrinsic"
import type { AccountInfo } from '@polkadot/types/interfaces'
import config from "../config"

const main = async () => {
  try {
    console.log("Connecting to Avail Turing testnet:", config.endpoint)
    const api = await initialize(config.endpoint)
    const account = getKeyringFromSeed(config.seed2)
    const decimals = getDecimals(api)
    
    // Recipient addresses
    const recipient1 = "5GVuBmrwGsDHfLZ3cNDMGLffNDC1W9xWQ7L8LQwzL2LHvi8v"
    const recipient2 = "5CtoWVBdtXxLvir2wKk3efieHNqfc6bXn66Bfg7C9U2eHogW"
    const recipient3 = "5Fk75MLgaEMjAMBBgavymuNAZGzUUbLUVJw8HLwP6ZV2VF4o"
    const recipient4 = "5E4K9evFdXTEVVRhXeMZufYbo6hwCnXwG4M5AUt8tDJ1qoU3"

    // Check all account balances first
    const [pichBalance, rec1Balance, rec2Balance, rec3Balance, rec4Balance] = await Promise.all([
      api.query.system.account(account.address),
      api.query.system.account(recipient1),
      api.query.system.account(recipient2),
      api.query.system.account(recipient3),
      api.query.system.account(recipient4)
    ]) as unknown as AccountInfo[]

    console.log("\nInitial account balances:")
    console.log(`Pich's balance: ${pichBalance.data.free.toHuman()}`)
    console.log(`Recipient 1 balance: ${rec1Balance.data.free.toHuman()}`)
    console.log(`Recipient 2 balance: ${rec2Balance.data.free.toHuman()}`)
    console.log(`Recipient 3 balance: ${rec3Balance.data.free.toHuman()}`)
    console.log(`Recipient 4 balance: ${rec4Balance.data.free.toHuman()}`)

    // Format amounts: 0.1 and 0.2 AVAIL
    const amount1 = formatNumberToBalance(0.001, decimals)
    const amount2 = formatNumberToBalance(0.002, decimals)
    const amount3 = formatNumberToBalance(0.003, decimals)
    const amount4 = formatNumberToBalance(0.004, decimals)
    
    console.log("\nPreparing batch transaction:")
    console.log(`- Transfer 0.01 AVAIL to ${recipient1}`)
    console.log(`- Transfer 0.02 AVAIL to ${recipient2}`)
    console.log(`- Transfer 0.03 AVAIL to ${recipient3}`)
    console.log(`- Transfer 0.04 AVAIL to ${recipient4}`)

    // Construct transactions to batch
    const txs = [
      api.tx.balances.transferKeepAlive(recipient1, amount1),
      api.tx.balances.transferKeepAlive(recipient2, amount2),
      api.tx.balances.transferKeepAlive(recipient3, amount3),
      api.tx.balances.transferKeepAlive(recipient4, amount4)
    ]

    // Estimate fees
    const info = await api.tx.utility.batch(txs).paymentInfo(account)
    
    // Calculate total required balance
    const totalAmount = amount1.add(amount2).add(amount3).add(amount4)
    const totalRequired = totalAmount.add(info.partialFee)
    
    console.log(`\nTransaction details:`)
    console.log(`- Total transfer amount: ${api.createType('Balance', totalAmount).toHuman()}`)
    console.log(`- Estimated fee: ${info.partialFee.toHuman()}`)
    console.log(`- Total required: ${api.createType('Balance', totalRequired).toHuman()}`)

    // Check if account has enough balance
    if (pichBalance.data.free.lt(totalRequired)) {
      throw new Error(
        `Insufficient balance.\n` +
        `Required: ${api.createType('Balance', totalRequired).toHuman()}\n` +
        `Available: ${pichBalance.data.free.toHuman()}`
      )
    }

    console.log("\nSending batch transaction...")
    
    // Send the batch transaction
    const txResult = await new Promise<ISubmittableResult>((resolve) => {
      api.tx.utility
        .batch(txs)
        .signAndSend(account, { nonce: -1 }, (result: ISubmittableResult) => {
          console.log(`Status: ${result.status.type}`)
          
          if (result.status.isInBlock) {
            console.log(`Included in block: ${result.status.asInBlock}`)
          }

          if (result.status.isFinalized || result.isError) {
            resolve(result)
          }
        })
    })

    if (txResult.isError) {
      throw new Error("Transaction failed to submit")
    }

    if (txResult.dispatchError) {
      if (txResult.dispatchError.isModule) {
        const decoded = api.registry.findMetaError(txResult.dispatchError.asModule)
        const { docs, name, section } = decoded
        throw new Error(`${section}.${name}: ${docs.join(' ')}`)
      } else {
        throw new Error(txResult.dispatchError.toString())
      }
    }

    console.log(`\nSuccess! Batch transaction finalized in block: ${txResult.status.asFinalized}`)
    console.log(`Transaction hash: ${txResult.txHash.toString()}`)
    
    // Get and log recipient balances after transfer
    const updatedBalances = await Promise.all([
      api.query.system.account(recipient1),
      api.query.system.account(recipient2),
      api.query.system.account(recipient3),
      api.query.system.account(recipient4)
    ]) as unknown as AccountInfo[]

    console.log("\nRecipient balances after transfer:")
    console.log(`${recipient1}: ${updatedBalances[0].data.free.toHuman()}`)
    console.log(`${recipient2}: ${updatedBalances[1].data.free.toHuman()}`)
    console.log(`${recipient3}: ${updatedBalances[2].data.free.toHuman()}`)
    console.log(`${recipient4}: ${updatedBalances[3].data.free.toHuman()}`)

    process.exit(0)
  } catch (err: any) {
    console.error("\nError:", err.message)
    process.exit(1)
  }
}

main() 
