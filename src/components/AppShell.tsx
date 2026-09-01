import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Activity,
  Check,
  ChevronRight,
  ExternalLink,
  Laptop,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Wallet,
  X,
} from 'lucide-react'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { bscTestnet } from 'wagmi/chains'

const shorten = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

type WalletProfile = {
  mark: string
  tone: string
  description: string
  priority: number
}

type WalletAvailability = 'checking' | 'available' | 'unavailable'

function supportsRemoteConnection(id: string) {
  return id === 'walletConnect'
}

function walletProfile(id: string, name: string): WalletProfile {
  const identity = `${id} ${name}`.toLowerCase()
  if (identity.includes('bitget') || identity.includes('bitkeep')) {
    return { mark: 'BG', tone: 'bitget', description: 'Recommended for the submission wallet', priority: 0 }
  }
  if (identity.includes('metamask')) {
    return { mark: 'MM', tone: 'metamask', description: 'Detected MetaMask browser extension', priority: 1 }
  }
  if (identity.includes('coinbase')) {
    return { mark: 'CB', tone: 'coinbase', description: 'Extension or Coinbase Wallet mobile', priority: 2 }
  }
  if (identity.includes('walletconnect')) {
    return { mark: 'QR', tone: 'walletconnect', description: 'Scan with Bitget, Binance, OKX, Trust, or another mobile wallet', priority: 3 }
  }
  if (identity.includes('binance')) {
    return { mark: 'BN', tone: 'binance', description: 'Detected Binance Wallet extension', priority: 4 }
  }
  if (identity.includes('okx')) {
    return { mark: 'OK', tone: 'okx', description: 'Detected OKX Wallet extension', priority: 5 }
  }
  if (identity.includes('trust')) {
    return { mark: 'TW', tone: 'trust', description: 'Detected extension or Trust Wallet DApp browser', priority: 6 }
  }
  return { mark: 'WEB', tone: 'browser', description: 'Use an installed EVM browser wallet', priority: 8 }
}

function friendlyConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (/rejected|denied|declined|4001/i.test(message)) return ''
  if (/failed to fetch dynamically imported module|cannot find.*connect-evm/i.test(message)) {
    return 'The MetaMask connection module did not load. Refresh this page and try again.'
  }
  if (/provider|install|not found|unavailable/i.test(message)) {
    return 'Wallet not detected. Install or open it, then try again.'
  }
  return 'Could not connect. Check that the wallet is unlocked and try again.'
}

function WalletButton() {
  const { address, chainId, isConnected } = useAccount()
  const { connectAsync, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const [showWallets, setShowWallets] = useState(false)
  const [pendingConnectorId, setPendingConnectorId] = useState<string | null>(null)
  const [connectionError, setConnectionError] = useState('')
  const [availability, setAvailability] = useState<Record<string, WalletAvailability>>({})
  const [isDetecting, setIsDetecting] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const uniqueConnectors = useMemo(() => {
    const unique = new Map<string, (typeof connectors)[number]>()
    for (const connector of connectors) {
      const profile = walletProfile(connector.id, connector.name)
      const key = profile.tone === 'browser' ? connector.name.toLowerCase() : profile.tone
      if (!unique.has(key)) unique.set(key, connector)
    }
    return [...unique.values()].toSorted((left, right) => {
      const a = walletProfile(left.id, left.name).priority
      const b = walletProfile(right.id, right.name).priority
      return a - b
    })
  }, [connectors])

  const detectWallets = useCallback(async () => {
    setIsDetecting(true)
    setConnectionError('')
    setAvailability(Object.fromEntries(uniqueConnectors.map((connector) => [connector.uid, 'checking'])))

    const results = await Promise.all(uniqueConnectors.map(async (connector) => {
      if (supportsRemoteConnection(connector.id)) return [connector.uid, 'available'] as const

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const provider = await connector.getProvider().catch(() => undefined)
        if (provider) return [connector.uid, 'available'] as const
        if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 350))
      }
      return [connector.uid, 'unavailable'] as const
    }))

    setAvailability(Object.fromEntries(results))
    setIsDetecting(false)
  }, [uniqueConnectors])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (showWallets && !dialog.open) dialog.showModal()
    if (!showWallets && dialog.open) dialog.close()
  }, [showWallets])

  useEffect(() => {
    if (showWallets) void detectWallets()
  }, [detectWallets, showWallets])

  const availableConnectors = useMemo(
    () => uniqueConnectors.filter((connector) => availability[connector.uid] !== 'unavailable'),
    [availability, uniqueConnectors],
  )

  const hasWalletConnect = uniqueConnectors.some((connector) => connector.id === 'walletConnect')

  const chooseWallet = async (connector: (typeof connectors)[number]) => {
    setPendingConnectorId(connector.uid)
    setConnectionError('')
    if (dialogRef.current?.open) dialogRef.current.close()
    setShowWallets(false)
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    try {
      await connectAsync({ connector })
    } catch (error) {
      const friendlyError = friendlyConnectionError(error)
      if (friendlyError) {
        setConnectionError(friendlyError)
        setShowWallets(true)
      }
    } finally {
      setPendingConnectorId(null)
    }
  }

  if (isConnected && address) {
    if (chainId !== bscTestnet.id) {
      return (
        <button
          className="button button-outline wallet-button"
          type="button"
          disabled={isSwitching}
          aria-busy={isSwitching}
          onClick={() => switchChain({ chainId: bscTestnet.id })}
        >
          <Wallet size={16} aria-hidden="true" />
          {isSwitching ? 'Switching…' : 'Switch to BSC Testnet'}
        </button>
      )
    }

    return (
      <button className="button button-secondary wallet-button" type="button" onClick={() => disconnect()} title="Disconnect wallet">
        <span className="network-dot" aria-hidden="true" />
        <span className="mono">{shorten(address)}</span>
      </button>
    )
  }

  return (
    <div className="wallet-menu">
      <button className="button wallet-button wallet-trigger" type="button" onClick={() => setShowWallets(true)}>
        <Wallet size={16} aria-hidden="true" />
        Connect wallet
      </button>

      <dialog
        className="wallet-dialog"
        ref={dialogRef}
        aria-labelledby="wallet-dialog-title"
        onCancel={() => setShowWallets(false)}
        onClose={() => setShowWallets(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setShowWallets(false)
        }}
      >
        <section className="wallet-dialog-card">
          <header className="wallet-dialog-header">
            <div className="wallet-dialog-symbol"><Wallet size={20} aria-hidden="true" /></div>
            <div>
              <span className="section-kicker">SIGNING WALLET</span>
              <h2 id="wallet-dialog-title">Connect securely</h2>
              <p>Choose a wallet for BSC Testnet. Connecting does not send a transaction.</p>
            </div>
            <button className="wallet-close" type="button" aria-label="Close wallet dialog" onClick={() => setShowWallets(false)}>
              <X size={19} aria-hidden="true" />
            </button>
          </header>

          <div className="wallet-network-note">
            <span><span className="network-dot" aria-hidden="true" /> BSC Testnet</span>
            <span><ShieldCheck size={14} aria-hidden="true" /> No seed phrase requested</span>
          </div>

          <div className="wallet-options" aria-label="Available wallet connections">
            {availableConnectors.length ? availableConnectors.map((connector) => {
              const profile = walletProfile(connector.id, connector.name)
              const connecting = isPending && pendingConnectorId === connector.uid
              const checking = availability[connector.uid] !== 'available'
              return (
                <button
                  className="wallet-option"
                  key={connector.uid}
                  type="button"
                  disabled={isPending || checking}
                  aria-busy={connecting}
                  onClick={() => chooseWallet(connector)}
                >
                  <span className={`wallet-mark wallet-mark-${profile.tone}`}>{profile.mark}</span>
                  <span className="wallet-option-copy">
                    <strong>{connector.name}</strong>
                    <small>{profile.description}</small>
                  </span>
                  {connecting || checking ? <LoaderCircle className="spin" size={18} aria-hidden="true" /> : profile.priority === 0 ? <span className="wallet-recommended"><Check size={12} /> Best fit</span> : <ChevronRight size={18} aria-hidden="true" />}
                </button>
              )
            }) : (
              <div className="wallet-empty">
                <Laptop size={20} aria-hidden="true" />
                <div><strong>No browser wallet detected</strong><p>Install a wallet or open this site inside its DApp browser.</p></div>
              </div>
            )}
            <button className="wallet-detect" type="button" disabled={isDetecting || isPending} onClick={() => void detectWallets()}>
              <RefreshCw className={isDetecting ? 'spin' : ''} size={14} aria-hidden="true" />
              {isDetecting ? 'Detecting wallets…' : 'Detect wallets again'}
            </button>
          </div>

          {connectionError ? <div className="wallet-error" role="alert"><strong>Connection failed</strong><span>{connectionError}</span></div> : null}

          <div className="wallet-more">
            <div><Smartphone size={17} aria-hidden="true" /><span><strong>Using a phone?</strong><small>Open MANDATE inside Bitget, Binance, OKX, or Trust Wallet's DApp browser.</small></span></div>
            <div className="wallet-supported" aria-label="Wallet connection coverage">
              <span>Installed extensions appear automatically</span>
              <span>{hasWalletConnect ? 'Mobile wallets available by QR' : 'Mobile QR pending configuration'}</span>
            </div>
          </div>

          <footer className="wallet-dialog-footer">
            <ShieldCheck size={15} aria-hidden="true" />
            <span>MANDATE can request signatures, but it can never access your recovery phrase.</span>
          </footer>
        </section>
      </dialog>
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink to="/" className="wordmark" aria-label="MANDATE home"><span aria-hidden="true">M</span>MANDATE</NavLink>
        <nav className="primary-nav" aria-label="Primary navigation">
          <NavLink to="/" end>Discover</NavLink>
          <NavLink to="/results">Mandates</NavLink>
          <NavLink to="/evidence">Evidence</NavLink>
        </nav>
        <WalletButton />
      </header>
      <main>{children}</main>
      <footer className="status-bar">
        <div className="status-protocols mono"><span>BSC Testnet</span><span>ERC-8004</span><span>ERC-8183</span></div>
        <div className="status-health">
          <Activity size={14} aria-hidden="true" /><span>Systems ready</span>
          <a href="https://testnet.bscscan.com" target="_blank" rel="noreferrer">Explorer <ExternalLink size={12} aria-hidden="true" /></a>
        </div>
      </footer>
    </div>
  )
}
