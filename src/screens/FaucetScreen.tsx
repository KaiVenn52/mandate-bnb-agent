import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react'
import { formatUnits } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { bscTestnet } from 'wagmi/chains'
import {
  erc20BalanceAbi,
  U_FAUCET_ADDRESS,
  U_TOKEN_ADDRESS,
  uFaucetAbi,
} from '../services/uFaucet'

const expectedWallet = (
  import.meta.env.VITE_SUBMISSION_WALLET_ADDRESS ?? '0xD30BbB80c863c9B94622EF92337AaD65148D2EC3'
).toLowerCase()

type FaucetState = {
  amount: bigint
  balance: bigint
  eligible: boolean
  tokenMatches: boolean
}

export function FaucetScreen() {
  const { address, chainId, isConnected } = useAccount()
  const walletClient = useWalletClient()
  const publicClient = usePublicClient({ chainId: bscTestnet.id })
  const [state, setState] = useState<FaucetState>()
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState('')
  const [transactionHash, setTransactionHash] = useState<`0x${string}`>()

  const isExpectedWallet = address?.toLowerCase() === expectedWallet
  const readyToSign = Boolean(
    isConnected && isExpectedWallet && chainId === bscTestnet.id && state?.eligible && state.tokenMatches,
  )

  const refresh = useCallback(async () => {
    if (!publicClient || !address) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [amount, eligible, token, balance] = await Promise.all([
        publicClient.readContract({ address: U_FAUCET_ADDRESS, abi: uFaucetAbi, functionName: 'tokenAmount' }),
        publicClient.readContract({ address: U_FAUCET_ADDRESS, abi: uFaucetAbi, functionName: 'allowedToWithdraw', args: [address] }),
        publicClient.readContract({ address: U_FAUCET_ADDRESS, abi: uFaucetAbi, functionName: 'tokenInstance' }),
        publicClient.readContract({ address: U_TOKEN_ADDRESS, abi: erc20BalanceAbi, functionName: 'balanceOf', args: [address] }),
      ])
      setState({
        amount,
        balance,
        eligible,
        tokenMatches: token.toLowerCase() === U_TOKEN_ADDRESS.toLowerCase(),
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to read BSC Testnet state.')
    } finally {
      setLoading(false)
    }
  }, [address, publicClient])

  useEffect(() => { void refresh() }, [refresh])

  const claim = async () => {
    if (!walletClient.data || !publicClient || !address || !readyToSign) return
    setClaiming(true)
    setError('')
    try {
      const simulation = await publicClient.simulateContract({
        account: address,
        address: U_FAUCET_ADDRESS,
        abi: uFaucetAbi,
        functionName: 'requestTokens',
      })
      const hash = await walletClient.data.writeContract({ ...simulation.request, chain: bscTestnet })
      setTransactionHash(hash)
      await publicClient.waitForTransactionReceipt({ hash })
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Claim failed or the wallet signature was rejected.')
    } finally {
      setClaiming(false)
    }
  }

  const status = !isConnected
    ? 'CONNECT WALLET'
    : !isExpectedWallet
      ? 'WRONG WALLET'
      : chainId !== bscTestnet.id
        ? 'WRONG NETWORK'
        : loading
          ? 'VERIFYING CONTRACT'
          : !state?.tokenMatches
            ? 'TOKEN MISMATCH — BLOCKED'
            : state.eligible
              ? 'SAFE TO REQUEST'
              : 'ALREADY CLAIMED / COOLDOWN'

  return (
    <section className="faucet-screen page-gutter">
      <div className="faucet-heading">
        <span className="section-kicker">TESTNET SETUP · ERC-8183</span>
        <h1>Request the settlement asset</h1>
        <p>A guarded, single-purpose call for 10 U on BSC Testnet. No token approval, permit, message signature, or BNB transfer is requested.</p>
      </div>

      <div className="registration-guard" role="status">
        <ShieldCheck size={18} />
        <div><strong>Transaction guard</strong><p>All four conditions below must verify before the signing button unlocks.</p></div>
        <span className={readyToSign ? 'guard-ready' : 'guard-blocked'}>{status}</span>
      </div>

      <div className="faucet-verification-grid">
        <article><small>Network</small><strong>BSC Testnet</strong><code>Chain ID 97 / 0x61</code></article>
        <article><small>Destination contract</small><strong>U Faucet</strong><code>{U_FAUCET_ADDRESS}</code></article>
        <article><small>Exact function</small><strong>requestTokens()</strong><code>No parameters · Value 0 BNB</code></article>
        <article><small>Received token</small><strong>{state ? `${formatUnits(state.amount, 18)} U` : 'Verifying…'}</strong><code>{U_TOKEN_ADDRESS}</code></article>
      </div>

      <div className="faucet-action-card">
        <div>
          <LockKeyhole size={20} />
          <span><strong>Current balance</strong><small>{state ? `${formatUnits(state.balance, 18)} U` : 'Waiting for public RPC'}</small></span>
        </div>
        <button className="button button-primary" type="button" disabled={!readyToSign || claiming} onClick={claim}>
          {claiming ? <><LoaderCircle className="spin" size={16} /> Confirming on BSC Testnet…</> : 'Request 10 test U'}
        </button>
      </div>

      {error ? <div className="inline-error" role="alert"><div><strong>Transaction remains blocked</strong><p>{error}</p></div></div> : null}
      {transactionHash ? (
        <a className="faucet-proof" href={`https://testnet.bscscan.com/tx/${transactionHash}`} target="_blank" rel="noreferrer">
          View immutable transaction proof <ExternalLink size={14} />
        </a>
      ) : null}
    </section>
  )
}
