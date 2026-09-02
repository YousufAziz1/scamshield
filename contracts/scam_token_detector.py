# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json

class ScamTokenDetector(gl.Contract):
    scan_results: TreeMap[str, str]

    def __init__(self):
        pass

    @gl.public.write
    def scan_token(self, token_address: str, chain_id: str) -> None:
        # Supported chains and their authoritative provider identifiers
        supported_chains = {
            'ethereum': {'goplus': '1', 'dex': 'ethereum'},
            'bsc':      {'goplus': '56', 'dex': 'bsc'},
            'polygon':  {'goplus': '137', 'dex': 'polygon'},
            'arbitrum': {'goplus': '42161', 'dex': 'arbitrum'},
            'base':     {'goplus': '8453', 'dex': 'base'},
            'solana':   {'goplus': 'solana', 'dex': 'solana'},
        }

        clean_chain = chain_id.strip().lower()
        clean_addr = token_address.strip().lower()
        cfg = supported_chains.get(clean_chain, {'goplus': '1', 'dex': 'ethereum'})
        is_solana = clean_chain == 'solana'

        # Fetch external market and security data for validator consensus prompt
        def build_analysis_prompt() -> str:
            # ── 1. Parse & Chain-Match DexScreener Market Data ──
            dex_evidence = {
                'chain_matched': False,
                'pair_address': None,
                'base_token_name': None,
                'base_token_symbol': None,
                'liquidity_usd': None,
                'price_usd': None,
                'fdv': None,
            }
            try:
                dex_url = f"https://api.dexscreener.com/latest/dex/tokens/{clean_addr}"
                dex_resp = gl.nondet.web.get(dex_url)
                if dex_resp.status_code == 200:
                    body = dex_resp.body.decode('utf-8')
                    parsed_dex = json.loads(body)
                    pairs = parsed_dex.get('pairs') or []
                    for p in pairs:
                        p_chain = str(p.get('chainId', '')).lower()
                        p_base = str(p.get('baseToken', {}).get('address', '')).lower()
                        # Strict chain and address matching: reject pairs from other chains or tokens
                        if p_chain == cfg['dex'] and p_base == clean_addr:
                            dex_evidence['chain_matched'] = True
                            dex_evidence['pair_address'] = p.get('pairAddress')
                            dex_evidence['base_token_name'] = p.get('baseToken', {}).get('name')
                            dex_evidence['base_token_symbol'] = p.get('baseToken', {}).get('symbol')
                            dex_evidence['liquidity_usd'] = p.get('liquidity', {}).get('usd')
                            dex_evidence['price_usd'] = p.get('priceUsd')
                            dex_evidence['fdv'] = p.get('fdv')
                            break
            except Exception:
                pass

            # ── 2. Parse & Chain-Match GoPlus Token Security (EVM) ──
            goplus_token_evidence = {
                'record_found': False,
                'is_honeypot': None,
                'buy_tax': None,
                'sell_tax': None,
                'cannot_sell_all': None,
                'is_open_source': None,
                'token_name': None,
                'token_symbol': None,
            }
            if not is_solana:
                try:
                    gp_url = (
                        f"https://api.gopluslabs.io/api/v1/token_security/{cfg['goplus']}"
                        f"?contract_addresses={clean_addr}"
                    )
                    gp_resp = gl.nondet.web.get(gp_url)
                    if gp_resp.status_code == 200:
                        body = gp_resp.body.decode('utf-8')
                        parsed_gp = json.loads(body)
                        result = parsed_gp.get('result') or {}
                        token_record = result.get(clean_addr) or {}
                        if token_record:
                            goplus_token_evidence['record_found'] = True
                            goplus_token_evidence['is_honeypot'] = token_record.get('is_honeypot')
                            goplus_token_evidence['buy_tax'] = token_record.get('buy_tax')
                            goplus_token_evidence['sell_tax'] = token_record.get('sell_tax')
                            goplus_token_evidence['cannot_sell_all'] = token_record.get('cannot_sell_all')
                            goplus_token_evidence['is_open_source'] = token_record.get('is_open_source')
                            goplus_token_evidence['token_name'] = token_record.get('token_name')
                            goplus_token_evidence['token_symbol'] = token_record.get('token_symbol')
                except Exception:
                    pass

            # ── 3. Parse & Chain-Match GoPlus NFT Security (EVM) ──
            goplus_nft_evidence = {
                'record_found': False,
                'nft_name': None,
                'nft_symbol': None,
                'nft_verified': None,
                'nft_open_source': None,
                'privileged_minting': None,
            }
            if not is_solana:
                try:
                    nft_url = (
                        f"https://api.gopluslabs.io/api/v1/nft_security/{cfg['goplus']}"
                        f"?contract_addresses={clean_addr}"
                    )
                    nft_resp = gl.nondet.web.get(nft_url)
                    if nft_resp.status_code == 200:
                        body = nft_resp.body.decode('utf-8')
                        parsed_nft = json.loads(body)
                        result = parsed_nft.get('result') or {}
                        # Validate address match
                        if str(result.get('nft_address', '')).lower() == clean_addr:
                            goplus_nft_evidence['record_found'] = True
                            goplus_nft_evidence['nft_name'] = result.get('nft_name')
                            goplus_nft_evidence['nft_symbol'] = result.get('nft_symbol')
                            goplus_nft_evidence['nft_verified'] = result.get('nft_verified')
                            goplus_nft_evidence['nft_open_source'] = result.get('nft_open_source')
                            goplus_nft_evidence['privileged_minting'] = result.get('privileged_minting', {}).get('value')
                except Exception:
                    pass

            # ── 4. Parse Birdeye Data (Solana only) ──
            birdeye_evidence = {
                'record_found': False,
                'name': None,
                'symbol': None,
                'liquidity': None,
            }
            if is_solana:
                try:
                    be_url = f"https://public-api.birdeye.so/public/token_overview?address={clean_addr}"
                    be_resp = gl.nondet.web.get(be_url)
                    if be_resp.status_code == 200:
                        body = be_resp.body.decode('utf-8')
                        parsed_be = json.loads(body)
                        data = parsed_be.get('data') or {}
                        if data:
                            birdeye_evidence['record_found'] = True
                            birdeye_evidence['name'] = data.get('name')
                            birdeye_evidence['symbol'] = data.get('symbol')
                            birdeye_evidence['liquidity'] = data.get('liquidity')
                except Exception:
                    pass

            # Check if authoritative chain-matched evidence exists
            has_chain_matched_evidence = (
                dex_evidence['chain_matched'] or
                goplus_token_evidence['record_found'] or
                goplus_nft_evidence['record_found'] or
                birdeye_evidence['record_found']
            )

            resolved_identity_name = (
                dex_evidence.get('base_token_name') or
                goplus_token_evidence.get('token_name') or
                goplus_nft_evidence.get('nft_name') or
                birdeye_evidence.get('name') or
                "UNKNOWN"
            )
            resolved_identity_symbol = (
                dex_evidence.get('base_token_symbol') or
                goplus_token_evidence.get('token_symbol') or
                goplus_nft_evidence.get('nft_symbol') or
                birdeye_evidence.get('symbol') or
                "UNKNOWN"
            )

            structured_evidence = {
                'requested_chain': clean_chain,
                'target_address': clean_addr,
                'has_chain_matched_evidence': has_chain_matched_evidence,
                'resolved_identity': {
                    'name': resolved_identity_name,
                    'symbol': resolved_identity_symbol,
                },
                'dex_market_evidence': dex_evidence,
                'goplus_token_evidence': goplus_token_evidence,
                'goplus_nft_evidence': goplus_nft_evidence,
                'birdeye_evidence': birdeye_evidence,
            }

            return f"""You are an objective blockchain security validator on GenLayer evaluating smart contract parameters and token threats.

TARGET CONTRACT: {clean_addr}
TARGET CHAIN: {clean_chain}

STRUCTURED CHAIN-MATCHED EVIDENCE:
{json.dumps(structured_evidence, indent=2)}

STRICT CONSENSUS ANALYSIS RULES:
1. ONLY utilize the structured evidence provided above that is strictly chain-matched to {clean_chain}.
2. Reject any data or claims from other chains or unverified sources.
3. IDENTITY RULE: The resolved token/project identity MUST be strictly derived from the parsed evidence (Name: {resolved_identity_name}, Symbol: {resolved_identity_symbol}). NEVER guess, fabricate, or substitute another project identity.
4. INSUFFICIENT DATA RULE: If has_chain_matched_evidence is FALSE, you MUST strictly return:
   - "verdict": "UNKNOWN"
   - "riskScore": 50
   - "summary": "Unable to verify token identity or security parameters. No authoritative market or contract metadata found on the selected network."
   - "evidenceSufficiency": "INSUFFICIENT"
5. If verified token/NFT parameters show no malicious functions (no honeypot, no sell block, no excessive tax), return "SAFE" with an appropriate low risk score (0-20), and "evidenceSufficiency": "SUFFICIENT".
6. If malicious patterns exist (honeypot, blacklisting, 100% tax, malicious minting), return "SCAM" or "RISKY" with an elevated risk score (70-100), and list the explicit findings in flags.

RESPOND EXCLUSIVELY WITH VALID JSON (no markdown fences, no explanatory text):
{{
  "verdict": "SAFE" | "RISKY" | "SCAM" | "UNKNOWN",
  "riskScore": <integer 0-100>,
  "evidenceSufficiency": "SUFFICIENT" | "INSUFFICIENT",
  "tokenIdentity": {{
    "name": "{resolved_identity_name}",
    "symbol": "{resolved_identity_symbol}",
    "chain": "{clean_chain}"
  }},
  "summary": "<clear 1-2 sentence explanation of the security findings>",
  "flags": [
    {{
      "id": "<snake_case_id>",
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "label": "<short flag title>",
      "detail": "<concise description of the flag>"
    }}
  ]
}}
"""

        # Validator consensus configuration with explicit Material Verdict Field Equivalence
        verdict_json_str = gl.eq_principle.prompt_non_comparative(
            build_analysis_prompt,
            task=(
                "Evaluate smart contract security and token identity using structured, chain-matched evidence. "
                "Produce a strictly formatted JSON verdict specifying verdict, riskScore, evidenceSufficiency, tokenIdentity, summary, and flags."
            ),
            criteria=(
                "MATERIAL VERDICT FIELD EQUIVALENCE PRINCIPLE: "
                "Two validator results are equivalent if and only if all material security conclusions align: "
                "1. IDENTITY & CHAIN EQUIVALENCE: Both outputs must bind to the requested chain ('" + clean_chain + "') and identify the exact same token/project (or both agree it is UNKNOWN). No substitution of another project is permitted. "
                "2. VERDICT EQUIVALENCE: Both outputs must arrive at the identical core verdict ('SAFE', 'RISKY', 'SCAM', or 'UNKNOWN'). "
                "3. RISK SCORE BRACKET EQUIVALENCE: The risk scores must be within 5 points of each other and belong to the same risk category. "
                "4. EVIDENCE SUFFICIENCY: Both must agree on evidenceSufficiency ('SUFFICIENT' vs 'INSUFFICIENT'). If chain evidence is missing, verdict MUST be UNKNOWN with riskScore 50. "
                "5. CORE SECURITY DRIVERS: Both outputs must agree on the presence or absence of primary risk flags (e.g. honeypot, sell restriction, missing metadata)."
            )
        )

        self.scan_results[token_address] = verdict_json_str

    @gl.public.view
    def get_scan_result(self, token_address: str) -> str:
        return self.scan_results.get(token_address, "")
