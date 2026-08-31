import { createConfig } from 'wagmi'
import { bsc, bscTestnet } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'
import { fallback, http, type EIP1193Provider } from 'viem'

type WalletWindow = Window & {
  bitkeep?: { ethereum?: EIP1193Provider }
  BinanceChain?: EIP1193Provider
  okxwallet?: EIP1193Provider
  trustwallet?: EIP1193Provider
  ethereum?: EIP1193Provider & { isTrust?: boolean }
}

const bitget = injected({
  target: {
    id: 'bitget',
    name: 'Bitget Wallet',
    provider(window) {
      return (window as WalletWindow | undefined)?.bitkeep?.ethereum
    },
  },
})

const binance = injected({
  target: {
    id: 'binance',
    name: 'Binance Wallet',
    provider(window) {
      return (window as WalletWindow | undefined)?.BinanceChain
    },
  },
})

const okx = injected({
  target: {
    id: 'okx',
    name: 'OKX Wallet',
    provider(window) {
      return (window as WalletWindow | undefined)?.okxwallet
    },
  },
})

const trust = injected({
  target: {
    id: 'trust',
    name: 'Trust Wallet',
    provider(window) {
      const walletWindow = window as WalletWindow | undefined
      return walletWindow?.trustwallet ?? (walletWindow?.ethereum?.isTrust ? walletWindow.ethereum : undefined)
    },
  },
})

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim()

const remoteWalletConnectors = walletConnectProjectId
  ? [walletConnect({
      projectId: walletConnectProjectId,
      showQrModal: true,
      metadata: {
        name: 'MANDATE',
        description: 'Outcome-first BNB Agent Marketplace',
        url: 'https://mandate-bnb-agent.vercel.app',
        icons: ['https://mandate-bnb-agent.vercel.app/favicon.svg'],
      },
    })]
  : []

export const wagmiConfig = createConfig({
  chains: [bscTestnet, bsc],
  connectors: [
    bitget,
    metaMask(),
    binance,
    okx,
    trust,
    ...remoteWalletConnectors,
    injected(),
  ],
  transports: {
    [bscTestnet.id]: fallback([
      http('https://bsc-testnet-dataseed.bnbchain.org'),
      http('https://data-seed-prebsc-1-s1.bnbchain.org:8545'),
      http('https://bsc-testnet.publicnode.com'),
    ]),
    [bsc.id]: http(),
  },
})
