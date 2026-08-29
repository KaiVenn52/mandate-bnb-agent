import { stringToHex } from 'viem'
import type { CategoryId } from '../catalog'

export const ERC8004_REGISTRY_ADDRESS = '0x8004A818BFB912233c491871b3d84c89A494BD9e' as const

export const erc8004RegistrationAbi = [
  {
    type: 'function',
    name: 'register',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentURI', type: 'string' },
      {
        name: 'metadata',
        type: 'tuple[]',
        components: [
          { name: 'metadataKey', type: 'string' },
          { name: 'metadataValue', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
] as const

export const erc8004RegisteredEventAbi = [
  {
    type: 'event',
    name: 'Registered',
    anonymous: false,
    inputs: [
      { indexed: true, name: 'agentId', type: 'uint256' },
      { indexed: false, name: 'agentURI', type: 'string' },
      { indexed: true, name: 'owner', type: 'address' },
    ],
  },
] as const

const encodeBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

export function buildAgentUri(input: {
  name: string
  description: string
  category: CategoryId
  origin: string
  serviceEndpoint?: string
  serviceProtocol?: 'A2A' | 'MCP'
  providerAddress?: string
}) {
  const serviceProtocol = input.serviceProtocol ?? 'A2A'
  const serviceEndpoint = input.serviceEndpoint ?? `${input.origin}/api/health`
  const registration = {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: input.name,
    description: input.description,
    image: '',
    services: [
      {
        name: serviceProtocol,
        endpoint: serviceEndpoint,
        version: serviceProtocol === 'A2A' ? '0.3.0' : '2025-06-18',
        capabilities: [input.category, 'live-verification', 'bounded-mandates'],
      },
      { name: 'web', endpoint: serviceEndpoint, version: '1.0.0' },
    ],
    ...(input.providerAddress ? { agentWallet: input.providerAddress } : {}),
    x402Support: false,
    active: true,
    registrations: [],
    supportedTrust: ['reputation', 'crypto-economic'],
  }

  return `data:application/json;base64,${encodeBase64(JSON.stringify(registration))}`
}

export function registrationMetadata(category: CategoryId) {
  return [
    {
      metadataKey: 'built_with',
      metadataValue: stringToHex('https://github.com/bnb-chain/bnbagent-sdk#v0.4.2'),
    },
    { metadataKey: 'category', metadataValue: stringToHex(category) },
    { metadataKey: 'product', metadataValue: stringToHex('MANDATE') },
  ] as const
}
