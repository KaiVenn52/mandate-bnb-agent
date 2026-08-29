import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, LoaderCircle, ShieldCheck, Wallet } from 'lucide-react'
import { parseEventLogs } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { bscTestnet } from 'wagmi/chains'
import { categories, categoryOrder } from '../catalog'
import {
  buildAgentUri,
  ERC8004_REGISTRY_ADDRESS,
  erc8004RegisteredEventAbi,
  erc8004RegistrationAbi,
  registrationMetadata,
} from '../services/erc8004'

type RegistrationRecord = {
  agentId: string
  transactionHash: `0x${string}`
}

type RegistrationRecords = Partial<Record<(typeof categoryOrder)[number], RegistrationRecord>>

const STORAGE_KEY = 'mandate:erc8004-registrations:v1'
const expectedWallet = (
  import.meta.env.VITE_SUBMISSION_WALLET_ADDRESS ?? '0xD30BbB80c863c9B94622EF92337AaD65148D2EC3'
).toLowerCase()

const loadRecords = (): RegistrationRecords => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as RegistrationRecords
  } catch {
    return {}
  }
}

export function RegistrationScreen() {
  const { address, chainId, isConnected } = useAccount()
  const walletClient = useWalletClient()
  const publicClient = usePublicClient({ chainId: bscTestnet.id })
  const [records, setRecords] = useState<RegistrationRecords>(loadRecords)
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [error, setError] = useState('')
  const isExpectedWallet = address?.toLowerCase() === expectedWallet
  const isPublicOrigin = !['localhost', '127.0.0.1'].includes(window.location.hostname)
  const hasBitgetProvider = Boolean((window as Window & { bitkeep?: { ethereum?: unknown } }).bitkeep?.ethereum)
  const canRegister = isConnected && isExpectedWallet && chainId === bscTestnet.id && isPublicOrigin

  const registerCategory = async (categoryId: (typeof categoryOrder)[number]) => {
    const category = categories[categoryId]
    const agent = category.agents[0]
    if (!walletClient.data || !publicClient || !address || !canRegister) return

    setActiveCategory(categoryId)
    setError('')
    try {
      const hash = await walletClient.data.writeContract({
        account: address,
        address: ERC8004_REGISTRY_ADDRESS,
        abi: erc8004RegistrationAbi,
        functionName: 'register',
        args: [
          buildAgentUri({
            name: agent.name,
            description: `${category.label} agent for bounded MANDATE jobs on BNB Chain.`,
            category: categoryId,
            origin: window.location.origin,
          }),
          registrationMetadata(categoryId),
        ],
        chain: bscTestnet,
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      const [registered] = parseEventLogs({
        abi: erc8004RegisteredEventAbi,
        eventName: 'Registered',
        logs: receipt.logs,
        strict: false,
      })
      const agentId = registered?.args.agentId?.toString() ?? 'pending-indexer'
      const next = { ...records, [categoryId]: { agentId, transactionHash: hash } }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setRecords(next)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Registration failed or signature was rejected.')
    } finally {
      setActiveCategory('')
    }
  }

  return (
    <section className="registration-screen page-gutter">
      <div className="registration-heading">
        <div>
          <h1>Register project reference identities</h1>
          <p>These four reference identities are controlled by the project wallet. For an independent marketplace provider, use the separate onboarding flow.</p>
        </div>
        <div className="registration-heading-actions"><Link className="button button-secondary" to="/provider-onboarding">Independent provider onboarding</Link><Link className="button button-secondary" to="/evidence">Back to evidence</Link></div>
      </div>

      <div className="registration-guard" role="status">
        <ShieldCheck size={18} />
        <div><strong>Signing guard</strong><p>Required wallet: <span className="mono">0xD30B…2EC3</span> · Required network: BSC Testnet (97)</p></div>
        <span className={canRegister ? 'guard-ready' : 'guard-blocked'}>
          {canRegister ? 'READY TO SIGN' : !isPublicOrigin ? 'AWAITING PUBLIC URL' : !isConnected ? 'CONNECT WALLET' : !isExpectedWallet ? 'WRONG WALLET' : 'WRONG NETWORK'}
        </span>
      </div>

      {!isPublicOrigin ? (
        <div className="inline-warning">
          Registration is intentionally disabled on localhost because the agent URI must contain a public service endpoint. Deploy first, then sign from the public URL.
        </div>
      ) : null}
      {isPublicOrigin && !hasBitgetProvider && !isConnected ? (
        <div className="bitget-handoff">
          <strong>Bitget Wallet is on your phone?</strong>
          <p>In Bitget Wallet, open <b>Discover / DApp Browser</b>, then paste this exact registration URL:</p>
          <code>{window.location.href}</code>
        </div>
      ) : null}
      {error ? <div className="inline-error" role="alert"><div><strong>Registration not completed</strong><p>{error}</p></div></div> : null}

      <div className="registration-list">
        {categoryOrder.map((categoryId, index) => {
          const category = categories[categoryId]
          const agent = category.agents[0]
          const record = records[categoryId] ?? (agent.registrationTxHash
            ? { agentId: agent.id, transactionHash: agent.registrationTxHash }
            : undefined)
          const isRegistering = activeCategory === categoryId
          return (
            <article className="registration-row" key={categoryId}>
              <span className="registration-index mono">0{index + 1}</span>
              <div><small>{category.label}</small><h2>{agent.name}</h2><p>{category.prompt}</p></div>
              <div className="registration-proof">
                {record ? (
                  <>
                    <strong className="positive">Agent #{record.agentId}</strong>
                    <a href={`https://testnet.bscscan.com/tx/${record.transactionHash}`} target="_blank" rel="noreferrer">Transaction proof <ExternalLink size={13} /></a>
                  </>
                ) : <span>No onchain identity yet</span>}
              </div>
              <button
                className="button button-primary"
                type="button"
                disabled={!canRegister || Boolean(record) || Boolean(activeCategory)}
                onClick={() => registerCategory(categoryId)}
              >
                {isRegistering ? <><LoaderCircle className="spin" size={16} /> Confirming…</> : record ? 'Registered' : <><Wallet size={16} /> Register identity</>}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
