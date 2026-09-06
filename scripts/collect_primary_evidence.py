"""Read-only Job 873 audit. Never loads environment files or signing credentials."""
import json
from datetime import datetime, timezone
import requests
from collect_termix_onchain import Web3, RPC_URLS, COMMERCE, ROUTER, GET_JOB_ABI, ROOT

PROVIDER = '0x1007950f2cd328ceA873e212b0D18EF17c51dc9f'
IDENTITY = '0x8004A818BFB912233c491871b3d84c89A494BD9e'
TOKEN = '0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565'
BASE = 'https://mandate-provider-yield.onrender.com'
KNOWN = ['0x0d0ec0d8e1368639f1037adb36b004fabbda8f84523d61e7bec6c4b5d064ca44', '0x7088528bbaf86c916f8279da98a9ecd3d902efe3f4dcd142e2ca71b448692c3b', '0x413a64410246ae228b573ecd0900819ef9f9fadbcd866a3fc7e9848a41fc3b21']

def main():
    w = Web3(Web3.HTTPProvider(RPC_URLS[0], request_kwargs={'timeout': 45}))
    assert w.eth.chain_id == 97
    job = w.eth.contract(address=COMMERCE, abi=GET_JOB_ABI).functions.getJob(873).call()
    assert job[7] == 3 and job[2].lower() == PROVIDER.lower() and job[1].lower() != job[2].lower()
    manifest = requests.get(BASE + '/mandate/deliverables/873.json', timeout=30).json()
    digest = '0x' + Web3.keccak(text=json.dumps(manifest, sort_keys=True, separators=(',', ':'), ensure_ascii=True)).hex().removeprefix('0x')
    assert digest == '0x' + job[10].hex().removeprefix('0x')
    owner_abi = [{'type':'function','name':'ownerOf','stateMutability':'view','inputs':[{'name':'id','type':'uint256'}],'outputs':[{'name':'','type':'address'}]}]
    owner = w.eth.contract(address=IDENTITY, abi=owner_abi).functions.ownerOf(2054).call()
    assert owner.lower() == PROVIDER.lower()
    hashes = set(KNOWN)
    archive = Web3(Web3.HTTPProvider(RPC_URLS[1], request_kwargs={'timeout': 45}))
    # Job-indexed events recover create, assignment, policy, budget and funding.
    # Bounded historical range around the completed September 4 proof.
    retrieval_gaps = []
    try:
        for start in range(128800000, 129060941, 5000):
            logs = archive.eth.get_logs({'fromBlock':start,'toBlock':min(start+4999,129060940), 'address':[COMMERCE,ROUTER], 'topics':[None, '0x'+format(873,'064x')]})
            hashes.update('0x'+x.transactionHash.hex().removeprefix('0x') for x in logs)
    except Exception as exc:
        retrieval_gaps.append('Historical lifecycle logs unavailable: ' + str(exc))
    transactions = []
    for h in hashes:
        t = w.eth.get_transaction(h); r = w.eth.get_transaction_receipt(h)
        assert r.status == 1
        transactions.append({'hash':h,'explorer_url':'https://testnet.bscscan.com/tx/'+h,'block':r.blockNumber,'from':t['from'],'to':t['to'],'value_wei':str(t['value']),'input':'0x'+t['input'].hex().removeprefix('0x'),'status':r.status,'logs':json.loads(Web3.to_json(r.logs))})
    transactions.sort(key=lambda t:t['block'])
    execution = next(t for t in transactions if t['hash'] == KNOWN[0])
    submission = next(t for t in transactions if t['hash'] == KNOWN[1])
    settlement = next(t for t in transactions if t['hash'] == KNOWN[2])
    expected_call = '0x095ea7b3' + COMMERCE[2:].lower().zfill(64) + format(1, '064x')
    assert execution['from'].lower() == PROVIDER.lower()
    assert execution['to'].lower() == TOKEN.lower() and execution['input'].lower() == expected_call
    assert execution['value_wei'] == '0'
    assert submission['from'].lower() == PROVIDER.lower() and submission['to'].lower() == COMMERCE.lower()
    assert submission['input'].startswith('0x9e63798d' + format(873, '064x') + digest[2:])
    assert settlement['to'].lower() == ROUTER.lower()
    assert settlement['input'].startswith('0x39c2ebb9' + format(873, '064x'))
    assert settlement['from'].lower() not in [PROVIDER.lower(), job[1].lower()]
    # Approvals are indexed by owner/spender, not job ID. Search the lifecycle window.
    approvals = []
    if not retrieval_gaps:
        approvals = archive.eth.get_logs({'fromBlock':transactions[0]['block']-100,'toBlock':129054135,'address':TOKEN,'topics':['0x'+Web3.keccak(text='Approval(address,address,uint256)').hex().removeprefix('0x'),'0x'+job[1][2:].lower().zfill(64),'0x'+COMMERCE[2:].lower().zfill(64)]})
    for log in approvals:
        h='0x'+log.transactionHash.hex().removeprefix('0x')
        if h in hashes: continue
        t=w.eth.get_transaction(h); r=w.eth.get_transaction_receipt(h)
        transactions.append({'hash':h,'explorer_url':'https://testnet.bscscan.com/tx/'+h,'block':r.blockNumber,'from':t['from'],'to':t['to'],'value_wei':str(t['value']),'input':'0x'+t['input'].hex().removeprefix('0x'),'status':r.status,'association':'client approval within lifecycle window; verify spender and amount in calldata','logs':json.loads(Web3.to_json(r.logs))})
    transactions.sort(key=lambda t:t['block'])
    result={'schema':'mandate.evidence-passport.v1','verified_at_utc':datetime.now(timezone.utc).isoformat(),'rpc':RPC_URLS[0],'chain_id':97,'job_id':873,'agent_id':2054,'identity_registry':IDENTITY,'identity_owner':owner,'commerce':COMMERCE,'client':job[1],'provider':job[2],'status':'COMPLETED','status_code':job[7],'budget_wei':str(job[5]),'description':json.loads(job[4]),'deliverable_hash':digest,'canonical_hash_matches':True,'manifest_url':BASE+'/mandate/deliverables/873.json','manifest':manifest,'transactions':transactions,'retrieval_gaps':retrieval_gaps,'unrecovered_steps':['identity registration transaction','create','signed acceptance and assignment','policy registration','set budget','client approval','fund'],'limitations':['Execution is test U approve(Commerce, 1 base unit), not a swap, liquidity routing, APY or profit proof.','Provider address is compromised and permanently testnet-only; no fresh authorization is implied.','Independent wallet does not establish independent business ownership.','Provider capability currently omits stored legacy receipts; do not equate health with onboarding readiness.']}
    path=ROOT/'public/evidence/evidence-passport-873.json'
    path.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'file':str(path),'status':result['status'],'hash_matches':True,'transactions':[(t['block'],t['hash'],t['input'][:10]) for t in transactions]}),flush=True)

if __name__ == '__main__': main()

