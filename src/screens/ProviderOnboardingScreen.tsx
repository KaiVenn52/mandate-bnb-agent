import { useState } from 'react'
import { ArrowLeft, CheckCircle2, ExternalLink, LoaderCircle, ShieldAlert, ShieldCheck, Wallet } from 'lucide-react'
import { parseEventLogs } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { bscTestnet } from 'wagmi/chains'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { categories, categoryOrder, verifiedServiceProvider } from '../catalog'
import {
  buildAgentUri,
  ERC8004_REGISTRY_ADDRESS,
  erc8004RegisteredEventAbi,
  erc8004RegistrationAbi,
  registrationMetadata,
} from '../services/erc8004'
import { saveProviderRegistration, loadProviderRegistrations, type ProviderRegistration } from '../services/providerRegistry'
import { probeProviderCapability } from '../services/providerCapability'

const isPublicOrigin = () => !['localhost', '127.0.0.1'].includes(window.location.hostname)
const configuredClientWallet = (import.meta.env.VITE_SUBMISSION_WALLET_ADDRESS ?? '0xD30BbB80c863c9B94622EF92337AaD65148D2EC3').toLowerCase()

async function assertRegistrationReceipt(publicClient: NonNullable<ReturnType<typeof usePublicClient>>, hash: `0x${string}`, provider: string) {
  const [receipt, transaction] = await Promise.all([
    publicClient.getTransactionReceipt({ hash }),
    publicClient.getTransaction({ hash }),
  ])
  if (receipt.status !== 'success' || !receipt.from || receipt.from.toLowerCase() !== provider.toLowerCase() || !receipt.to || !transaction.to || receipt.to.toLowerCase() !== transaction.to.toLowerCase() || transaction.to.toLowerCase() !== ERC8004_REGISTRY_ADDRESS.toLowerCase() || transaction.input === '0x') {
    throw new Error('ERC-8004 registration receipt is not a successful provider-signed call to the official BSC Testnet registry.')
  }
  return receipt
}

export function ProviderOnboardingScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedCategory = searchParams.get('category')
  const { address, chainId, isConnected } = useAccount()
  const walletClient = useWalletClient()
  const publicClient = usePublicClient({ chainId: bscTestnet.id })
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [records, setRecords] = useState<ProviderRegistration[]>(loadProviderRegistrations)
  const [error, setError] = useState('')
  // Never default a new identity to MANDATE's own read-only endpoint. A
  // provider must publish an endpoint it controls; otherwise ERC-8004 would
  // imply a service relationship that does not exist.
  const [serviceEndpoint, setServiceEndpoint] = useState('')
  const [serviceProtocol, setServiceProtocol] = useState<'A2A' | 'MCP'>('A2A')

  const isExistingProvider = address?.toLowerCase() === verifiedServiceProvider.toLowerCase()
  const isClientWallet = address?.toLowerCase() === configuredClientWallet
  const walletReady = Boolean(isConnected && address && chainId === bscTestnet.id && isPublicOrigin() && !isExistingProvider && !isClientWallet)

  const register = async (categoryId: (typeof categoryOrder)[number]) => {
    if (!walletReady || !address || !walletClient.data || !publicClient) return
    setActiveCategory(categoryId)
    setError('')
    try {
      if (!serviceEndpoint.trim()) throw new Error('Enter the HTTPS endpoint controlled by this provider before registering.')
      const endpoint = new URL(serviceEndpoint.trim())
      if (endpoint.protocol !== 'https:') throw new Error('Provider service endpoint must use HTTPS on the public deployment.')
      const category = categories[categoryId]
      // A registry receipt proves identity only. Require a provider-owned
      // capability document and a public testnet receipt before this identity
      // can enter the callable inventory.
      const capability = await probeProviderCapability(endpoint.toString(), categoryId, address)
      if (capability.document.service_protocol !== serviceProtocol) throw new Error(`Provider capability declares ${capability.document.service_protocol}, but the form is set to ${serviceProtocol}.`)
      const executionReceiptHashes: string[] = []
      const allowedContracts = new Set(capability.executionScope.contract_allowlist.map((value) => value.toLowerCase()))
      const maxValueWei = BigInt(capability.executionScope.max_value_wei)
      for (const hash of capability.executionReceipts) {
        const receipt = await publicClient.getTransactionReceipt({ hash: hash as `0x${string}` })
        const transaction = await publicClient.getTransaction({ hash: hash as `0x${string}` })
        if (receipt.status !== 'success' || !receipt.from || receipt.from.toLowerCase() !== address.toLowerCase() || !receipt.to || !transaction.to || transaction.to.toLowerCase() !== receipt.to.toLowerCase() || !allowedContracts.has(transaction.to.toLowerCase()) || transaction.input === '0x' || transaction.value > maxValueWei) {
          throw new Error(`Testnet receipt ${hash.slice(0, 10)}… is not a successful provider contract call inside the declared execution allowlist.`)
        }
        executionReceiptHashes.push(hash)
      }
      const executionVerified = executionReceiptHashes.length > 0 && (categoryId !== 'grid' || capability.trackRecord?.mode === 'realized-onchain')
      const agentName = `${category.agents[0].name} Provider`
      const agentUri = buildAgentUri({
        name: agentName,
        description: `${category.label} provider offering a bounded, hash-verifiable service on BSC Testnet.`,
        category: categoryId,
        origin: window.location.origin,
        serviceEndpoint: endpoint.toString(),
        serviceProtocol,
        providerAddress: address,
      })
      const request = await publicClient.simulateContract({
        account: address,
        address: ERC8004_REGISTRY_ADDRESS,
        abi: erc8004RegistrationAbi,
        functionName: 'register',
        args: [agentUri, registrationMetadata(categoryId)],
      })
      const transactionHash = await walletClient.data.writeContract({ ...request.request, chain: bscTestnet })
      const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash })
      await assertRegistrationReceipt(publicClient, transactionHash, address)
      const [registered] = parseEventLogs({
        abi: erc8004RegisteredEventAbi,
        eventName: 'Registered',
        logs: receipt.logs,
        strict: false,
      })
      const agentId = registered?.args.agentId?.toString()
      if (!agentId) throw new Error('The confirmed receipt did not contain an ERC-8004 agent ID.')
      if (!registered?.args.owner || registered.args.owner.toLowerCase() !== address.toLowerCase()) throw new Error('The confirmed ERC-8004 Registered event owner does not match the provider wallet.')
      const record: ProviderRegistration = {
        categoryId,
        agentId,
        providerAddress: address,
        registrationTxHash: transactionHash,
        name: agentName,
        serviceEndpoint: endpoint.toString(),
        serviceProtocol,
        endpointVerified: true,
        assetExecutionVerified: executionVerified,
        executionReceiptHashes,
        executionScope: capability.executionScope,
        trackRecord: capability.trackRecord,
        registeredAt: new Date().toISOString(),
      }
      saveProviderRegistration(record)
      setRecords(loadProviderRegistrations())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Provider registration failed or was rejected.')
    } finally {
      setActiveCategory('')
    }
  }

  const verifyExisting = async (record: ProviderRegistration, categoryId: (typeof categoryOrder)[number]) => {
    if (!walletReady || !address || !publicClient || address.toLowerCase() !== record.providerAddress.toLowerCase()) return
    setActiveCategory(categoryId)
    setError('')
    try {
      const registrationReceipt = await assertRegistrationReceipt(publicClient, record.registrationTxHash, address)
      const [registered] = parseEventLogs({ abi: erc8004RegisteredEventAbi, eventName: 'Registered', logs: registrationReceipt.logs, strict: false })
      if (!registered?.args.owner || registered.args.owner.toLowerCase() !== address.toLowerCase() || registered.args.agentId?.toString() !== record.agentId) throw new Error('The saved ERC-8004 registration receipt does not belong to this provider wallet or agent ID.')
      const capability = await probeProviderCapability(record.serviceEndpoint, categoryId, address, { requireExecutionReceipt: true })
      if (record.serviceProtocol && capability.document.service_protocol !== record.serviceProtocol) throw new Error(`Provider capability declares ${capability.document.service_protocol}, but the registration declares ${record.serviceProtocol}.`)
      const executionReceiptHashes: string[] = []
      const allowedContracts = new Set(capability.executionScope.contract_allowlist.map((value) => value.toLowerCase()))
      const maxValueWei = BigInt(capability.executionScope.max_value_wei)
      for (const hash of capability.executionReceipts) {
        const receipt = await publicClient.getTransactionReceipt({ hash: hash as `0x${string}` })
        const transaction = await publicClient.getTransaction({ hash: hash as `0x${string}` })
        if (receipt.status !== 'success' || !receipt.from || receipt.from.toLowerCase() !== address.toLowerCase() || !receipt.to || !transaction.to || transaction.to.toLowerCase() !== receipt.to.toLowerCase() || !allowedContracts.has(transaction.to.toLowerCase()) || transaction.input === '0x' || transaction.value > maxValueWei) {
          throw new Error(`Testnet receipt ${hash.slice(0, 10)}… is not a successful provider contract call inside the declared execution allowlist.`)
        }
        executionReceiptHashes.push(hash)
      }
      if (executionReceiptHashes.length === 0) throw new Error('At least one successful provider-signed BSC Testnet execution receipt is required.')
      saveProviderRegistration({
        ...record,
        endpointVerified: true,
        assetExecutionVerified: true,
        executionReceiptHashes,
        executionScope: capability.executionScope,
        trackRecord: capability.trackRecord,
      })
      setRecords(loadProviderRegistrations())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Provider capability verification failed.')
    } finally {
      setActiveCategory('')
    }
  }

  return (
    <section className="provider-onboarding-screen page-gutter">
      <button className="text-button back-button" type="button" onClick={() => navigate(requestedCategory ? `/results?category=${requestedCategory}` : '/evidence')}><ArrowLeft size={16} /> Back</button>
      <header className="provider-onboarding-heading">
        <div>
          <span className="section-kicker">PROVIDER ONBOARDING · ERC-8004 · BSC TESTNET</span>
          <h1>Add an independent provider.</h1>
          <p>Register a provider identity first, then prove one bounded testnet execution before it becomes hireable. No private key is requested and this page never signs for the provider.</p>
        </div>
        <div className={`provider-wallet-state ${walletReady ? 'is-ready' : ''}`}>
          <Wallet size={19} />
          <span><strong>{walletReady ? `${address?.slice(0, 6)}…${address?.slice(-4)}` : 'Wallet required'}</strong><small>{walletReady ? 'BSC Testnet · ready to sign identity only' : 'Connect a BSC Testnet wallet'}</small></span>
        </div>
      </header>

      <div className="provider-onboarding-guard" role="status">
        <ShieldCheck size={18} />
        <div><strong>Why this is required</strong><p>Two distinct provider wallets are needed before a category can claim independent supply. Current built-in identities use <span className="mono">0x34AB…2c7e</span>.</p></div>
        <span className={isExistingProvider || isClientWallet ? 'guard-blocked' : walletReady ? 'guard-ready' : 'guard-blocked'}>{isExistingProvider || isClientWallet ? 'USE A DIFFERENT WALLET' : walletReady ? 'READY' : 'CONNECT WALLET'}</span>
      </div>

      <div className="provider-endpoint-fields">
        <label>Service protocol<select value={serviceProtocol} onChange={(event) => setServiceProtocol(event.target.value as 'A2A' | 'MCP')}><option value="A2A">A2A</option><option value="MCP">MCP</option></select><small>{serviceProtocol === 'A2A' ? 'The provider document must point to its A2A acceptance/execution service.' : 'The provider document must point to its MCP acceptance/execution service.'}</small></label>
        <label className="provider-endpoint-field">Public provider capability endpoint<input type="url" value={serviceEndpoint} onChange={(event) => setServiceEndpoint(event.target.value)} placeholder="https://provider.example/mandate/capability" spellCheck={false} /><small>Must return `mandate.provider-service.v1` over HTTPS and match this wallet and category. Registration records identity only; a verified provider-signed BSC Testnet execution receipt is still required before hiring. Do not paste MANDATE's own read-only URL. <a href="/api/providers/capability-contract" target="_blank" rel="noreferrer">Open the exact contract</a>.</small></label>
      </div>

      {!isPublicOrigin() ? <div className="inline-warning">Provider registration is disabled on localhost because the ERC-8004 service URI must point to a public deployment. Open the deployed URL first.</div> : null}
      {error ? <div className="inline-error" role="alert"><ShieldAlert size={18} /><div><strong>Registration not completed</strong><p>{error}</p></div></div> : null}

      <div className="provider-category-grid">
        {categoryOrder.map((categoryId) => {
          const category = categories[categoryId]
          const record = records.find((item) => item.categoryId === categoryId && item.providerAddress.toLowerCase() === address?.toLowerCase())
          const isRegistering = activeCategory === categoryId
          return (
            <article className={`provider-category-card ${requestedCategory === categoryId ? 'is-highlighted' : ''}`} key={categoryId}>
              <div><small>0{categoryOrder.indexOf(categoryId) + 1} · {category.label}</small><h2>{category.agents[0].name}</h2><p>{category.description}</p></div>
              {record ? (
                <div className="provider-registration-proof">
                  <CheckCircle2 size={16} />
                  <span>
                    <strong>Registered as #{record.agentId}</strong>
                    <a href={`https://testnet.bscscan.com/tx/${record.registrationTxHash}`} target="_blank" rel="noreferrer">Open identity receipt <ExternalLink size={12} /></a>
                    <small>{record.assetExecutionVerified
                      ? `Capability + execution verified · ${record.executionReceiptHashes?.length ?? 0} testnet receipt${record.executionReceiptHashes?.length === 1 ? '' : 's'}${record.trackRecord?.mode === 'realized-onchain' ? ' · realized track record' : ''}`
                      : 'Identity + endpoint recorded · execution receipt required · not hireable'}</small>
                    {record.executionReceiptHashes?.slice(0, 2).map((hash) => <a key={hash} href={`https://testnet.bscscan.com/tx/${hash}`} target="_blank" rel="noreferrer">Execution {hash.slice(0, 10)}… <ExternalLink size={12} /></a>)}
                    {record.trackRecord?.mode === 'realized-onchain' ? <small>{record.trackRecord.summary.win_rate_pct}% win rate · {record.trackRecord.summary.max_drawdown_pct}% max drawdown · {record.trackRecord.onchain_evidence.transactions.length} linked trades</small> : null}
                    {!record.assetExecutionVerified ? <Link to={`/registry-agent/${record.agentId}?category=${categoryId}`}>Open direct-hire profile</Link> : null}
                  </span>
                  {!record.endpointVerified || !record.assetExecutionVerified || !record.executionScope || (categoryId === 'grid' && !record.trackRecord) ? <button className="button button-secondary compact-button" type="button" disabled={!walletReady || Boolean(activeCategory) || address?.toLowerCase() !== record.providerAddress.toLowerCase()} onClick={() => verifyExisting(record, categoryId)}>{isRegistering ? <><LoaderCircle className="spin" size={14} /> Verifying…</> : 'Verify execution evidence'}</button> : null}
                </div>
              ) : (
                <button className="button button-primary" type="button" disabled={!walletReady || isExistingProvider || Boolean(activeCategory) || !serviceEndpoint.trim()} onClick={() => register(categoryId)}>
                  {isRegistering ? <><LoaderCircle className="spin" size={16} /> Confirming…</> : <><Wallet size={16} /> Register provider identity</>}
                </button>
              )}
              <small className="provider-category-note">Identity registration is gas-only. Hiring unlocks only after provider-owned execution evidence is verified.</small>
            </article>
          )
        })}
      </div>

      <section className="provider-onboarding-next">
        <ShieldCheck size={19} />
        <div><strong>After registration</strong><p>Switch to a separate client wallet and create the bootstrap hire. The provider worker accepts the exact mandate, executes its configured allowlisted testnet action and submits the ERC-8183 deliverable. Then reconnect the provider wallet here and verify the receipt. Provider diversity proves identity, not performance; MANDATE will not invent either.</p></div>
      </section>
    </section>
  )
}
