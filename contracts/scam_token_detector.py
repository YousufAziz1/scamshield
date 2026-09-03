# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json

# Canonical Chain Registry
CANONICAL_CHAINS = {
    'ethereum': {'name': 'ethereum', 'id': '1', 'dex': 'ethereum', 'goplus': '1'},
    'eth': {'name': 'ethereum', 'id': '1', 'dex': 'ethereum', 'goplus': '1'},
    'ethereum-mainnet': {'name': 'ethereum', 'id': '1', 'dex': 'ethereum', 'goplus': '1'},
    '1': {'name': 'ethereum', 'id': '1', 'dex': 'ethereum', 'goplus': '1'},
    'bsc': {'name': 'bsc', 'id': '56', 'dex': 'bsc', 'goplus': '56'},
    'binance': {'name': 'bsc', 'id': '56', 'dex': 'bsc', 'goplus': '56'},
    'binance-smart-chain': {'name': 'bsc', 'id': '56', 'dex': 'bsc', 'goplus': '56'},
    '56': {'name': 'bsc', 'id': '56', 'dex': 'bsc', 'goplus': '56'},
    'polygon': {'name': 'polygon', 'id': '137', 'dex': 'polygon', 'goplus': '137'},
    'matic': {'name': 'polygon', 'id': '137', 'dex': 'polygon', 'goplus': '137'},
    '137': {'name': 'polygon', 'id': '137', 'dex': 'polygon', 'goplus': '137'},
    'arbitrum': {'name': 'arbitrum', 'id': '42161', 'dex': 'arbitrum', 'goplus': '42161'},
    'arb': {'name': 'arbitrum', 'id': '42161', 'dex': 'arbitrum', 'goplus': '42161'},
    '42161': {'name': 'arbitrum', 'id': '42161', 'dex': 'arbitrum', 'goplus': '42161'},
    'base': {'name': 'base', 'id': '8453', 'dex': 'base', 'goplus': '8453'},
    '8453': {'name': 'base', 'id': '8453', 'dex': 'base', 'goplus': '8453'},
    'solana': {'name': 'solana', 'id': 'solana', 'dex': 'solana', 'goplus': 'solana'},
    'sol': {'name': 'solana', 'id': 'solana', 'dex': 'solana', 'goplus': 'solana'},
}

class ScamTokenDetector(gl.Contract):
    scan_results: TreeMap[str, str]

    def __init__(self):
        pass

    @gl.public.write
    def scan_token(self, token_address: str, chain_id: str) -> None:
        raw_chain = chain_id.strip().lower()
        clean_addr = token_address.strip().lower()

        # Canonical chain resolution
        chain_info = CANONICAL_CHAINS.get(raw_chain)
        if not chain_info:
            canonical_chain = raw_chain
            canonical_chain_id = "UNKNOWN"
            is_supported_chain = False
        else:
            canonical_chain = chain_info['name']
            canonical_chain_id = chain_info['id']
            is_supported_chain = True

        is_solana = canonical_chain == 'solana'

        # Fetch external market and security data inside non-deterministic execution
        def build_analysis_prompt() -> str:
            provider_evidence_list = []
            evidence_rejection_reasons = []

            if not is_supported_chain:
                evidence_rejection_reasons.append(f"CHAIN_NOT_SUPPORTED: Requested chain '{raw_chain}' is not in canonical registry.")

            # ── 1. Parse & Chain-Match DexScreener Market Data ──
            dex_evidence = {
                "provider": "dexscreener",
                "requested_chain": canonical_chain,
                "requested_chain_id": canonical_chain_id,
                "requested_address": clean_addr,
                "returned_chain": None,
                "returned_chain_id": None,
                "returned_address": None,
                "evidence_status": "UNAVAILABLE",
                "identity_match": False,
                "chain_match": False,
                "material_fields": {
                    "liquidity_usd": None,
                    "fdv_usd": None,
                    "price_usd": None,
                    "pair_address": None,
                    "base_token_name": None,
                    "base_token_symbol": None,
                },
                "risk_flags": [],
                "rejection_reason": None,
            }

            try:
                dex_url = f"https://api.dexscreener.com/latest/dex/tokens/{clean_addr}"
                dex_resp = gl.nondet.web.get(dex_url)
                if dex_resp.status_code == 200:
                    body = dex_resp.body.decode('utf-8')
                    parsed_dex = json.loads(body)
                    pairs = parsed_dex.get('pairs')
                    if pairs is None:
                        dex_evidence["evidence_status"] = "INVALID"
                        dex_evidence["rejection_reason"] = "NO_PAIRS_RETURNED"
                    elif len(pairs) == 0:
                        dex_evidence["evidence_status"] = "INVALID"
                        dex_evidence["rejection_reason"] = "EMPTY_PAIRS_LIST"
                    else:
                        matched_pair = None
                        chain_mismatch_detected = False
                        address_mismatch_detected = False

                        for p in pairs:
                            p_chain = str(p.get('chainId', '')).lower()
                            p_base = str(p.get('baseToken', {}).get('address', '')).lower()
                            p_pair_addr = str(p.get('pairAddress', '')).lower()

                            # Guard: Ensure requested address was not swapped with pair address
                            if p_pair_addr == clean_addr and p_base != clean_addr:
                                address_mismatch_detected = True
                                continue

                            # Check exact address matching
                            if p_base != clean_addr:
                                address_mismatch_detected = True
                                continue

                            # Check exact chain matching against canonical identifier
                            expected_dex_chain = chain_info['dex'] if is_supported_chain else canonical_chain
                            if p_chain != expected_dex_chain:
                                chain_mismatch_detected = True
                                continue

                            matched_pair = p
                            break

                        if matched_pair:
                            dex_evidence["evidence_status"] = "VALID"
                            dex_evidence["identity_match"] = True
                            dex_evidence["chain_match"] = True
                            dex_evidence["returned_chain"] = matched_pair.get('chainId')
                            dex_evidence["returned_address"] = matched_pair.get('baseToken', {}).get('address', '').lower()
                            dex_evidence["material_fields"] = {
                                "liquidity_usd": matched_pair.get('liquidity', {}).get('usd'),
                                "fdv_usd": matched_pair.get('fdv'),
                                "price_usd": matched_pair.get('priceUsd'),
                                "pair_address": matched_pair.get('pairAddress'),
                                "base_token_name": matched_pair.get('baseToken', {}).get('name'),
                                "base_token_symbol": matched_pair.get('baseToken', {}).get('symbol'),
                            }
                        else:
                            dex_evidence["evidence_status"] = "INVALID"
                            if chain_mismatch_detected and not address_mismatch_detected:
                                dex_evidence["rejection_reason"] = "CHAIN_MISMATCH: Pairs found only on non-requested chains"
                                evidence_rejection_reasons.append("DexScreener: Rejected cross-chain pair substitution.")
                            elif address_mismatch_detected:
                                dex_evidence["rejection_reason"] = "ADDRESS_MISMATCH: Returned token address does not match requested target"
                                evidence_rejection_reasons.append("DexScreener: Address mismatch between requested and returned pair tokens.")
                            else:
                                dex_evidence["rejection_reason"] = "NO_MATCHING_CHAIN_AND_ADDRESS_PAIR"
                else:
                    dex_evidence["evidence_status"] = "UNAVAILABLE"
                    dex_evidence["rejection_reason"] = f"HTTP_ERROR_{dex_resp.status_code}"
            except Exception as e:
                dex_evidence["evidence_status"] = "UNAVAILABLE"
                dex_evidence["rejection_reason"] = f"FETCH_EXCEPTION_{type(e).__name__}"

            provider_evidence_list.append(dex_evidence)

            # ── 2. Parse & Chain-Match GoPlus Token Security (EVM) ──
            goplus_token_evidence = {
                "provider": "goplus_token",
                "requested_chain": canonical_chain,
                "requested_chain_id": canonical_chain_id,
                "requested_address": clean_addr,
                "returned_chain": canonical_chain if is_supported_chain and not is_solana else None,
                "returned_chain_id": canonical_chain_id if is_supported_chain and not is_solana else None,
                "returned_address": None,
                "evidence_status": "UNAVAILABLE",
                "identity_match": False,
                "chain_match": False,
                "material_fields": {
                    "is_honeypot": None,
                    "buy_tax": None,
                    "sell_tax": None,
                    "cannot_sell_all": None,
                    "is_open_source": None,
                    "token_name": None,
                    "token_symbol": None,
                },
                "risk_flags": [],
                "rejection_reason": None,
            }

            if is_supported_chain and not is_solana:
                try:
                    gp_url = (
                        f"https://api.gopluslabs.io/api/v1/token_security/{chain_info['goplus']}"
                        f"?contract_addresses={clean_addr}"
                    )
                    gp_resp = gl.nondet.web.get(gp_url)
                    if gp_resp.status_code == 200:
                        body = gp_resp.body.decode('utf-8')
                        parsed_gp = json.loads(body)
                        result_map = parsed_gp.get('result') or {}
                        token_record = result_map.get(clean_addr)
                        if not token_record:
                            # Try case-insensitive key search
                            for k, v in result_map.items():
                                if str(k).lower() == clean_addr:
                                    token_record = v
                                    break

                        if token_record and isinstance(token_record, dict):
                            goplus_token_evidence["evidence_status"] = "VALID"
                            goplus_token_evidence["identity_match"] = True
                            goplus_token_evidence["chain_match"] = True
                            goplus_token_evidence["returned_address"] = clean_addr
                            
                            is_hp = token_record.get('is_honeypot')
                            buy_t = token_record.get('buy_tax')
                            sell_t = token_record.get('sell_tax')
                            no_sell = token_record.get('cannot_sell_all')
                            open_src = token_record.get('is_open_source')

                            goplus_token_evidence["material_fields"] = {
                                "is_honeypot": is_hp,
                                "buy_tax": buy_t,
                                "sell_tax": sell_t,
                                "cannot_sell_all": no_sell,
                                "is_open_source": open_src,
                                "token_name": token_record.get('token_name'),
                                "token_symbol": token_record.get('token_symbol'),
                            }

                            if is_hp == "1":
                                goplus_token_evidence["risk_flags"].append("HONEYPOT_DETECTED")
                            if no_sell == "1":
                                goplus_token_evidence["risk_flags"].append("SELLING_BLOCKED")
                            if buy_t and float(buy_t) > 0.2:
                                goplus_token_evidence["risk_flags"].append("HIGH_BUY_TAX")
                            if sell_t and float(sell_t) > 0.2:
                                goplus_token_evidence["risk_flags"].append("HIGH_SELL_TAX")
                        else:
                            goplus_token_evidence["evidence_status"] = "INVALID"
                            goplus_token_evidence["rejection_reason"] = "NO_RECORD_FOUND_FOR_ADDRESS"
                    else:
                        goplus_token_evidence["evidence_status"] = "UNAVAILABLE"
                        goplus_token_evidence["rejection_reason"] = f"HTTP_ERROR_{gp_resp.status_code}"
                except Exception as e:
                    goplus_token_evidence["evidence_status"] = "UNAVAILABLE"
                    goplus_token_evidence["rejection_reason"] = f"FETCH_EXCEPTION_{type(e).__name__}"
            else:
                goplus_token_evidence["evidence_status"] = "UNAVAILABLE"
                goplus_token_evidence["rejection_reason"] = "CHAIN_NOT_SUPPORTED_BY_GOPLUS_EVM"

            provider_evidence_list.append(goplus_token_evidence)

            # ── 3. Parse & Chain-Match GoPlus NFT Security (EVM) ──
            goplus_nft_evidence = {
                "provider": "goplus_nft",
                "requested_chain": canonical_chain,
                "requested_chain_id": canonical_chain_id,
                "requested_address": clean_addr,
                "returned_chain": canonical_chain if is_supported_chain and not is_solana else None,
                "returned_chain_id": canonical_chain_id if is_supported_chain and not is_solana else None,
                "returned_address": None,
                "evidence_status": "UNAVAILABLE",
                "identity_match": False,
                "chain_match": False,
                "material_fields": {
                    "nft_name": None,
                    "nft_symbol": None,
                    "nft_verified": None,
                    "nft_open_source": None,
                    "privileged_minting": None,
                    "malicious_nft_contract": None,
                },
                "risk_flags": [],
                "rejection_reason": None,
            }

            if is_supported_chain and not is_solana:
                try:
                    nft_url = (
                        f"https://api.gopluslabs.io/api/v1/nft_security/{chain_info['goplus']}"
                        f"?contract_addresses={clean_addr}"
                    )
                    nft_resp = gl.nondet.web.get(nft_url)
                    if nft_resp.status_code == 200:
                        body = nft_resp.body.decode('utf-8')
                        parsed_nft = json.loads(body)
                        result = parsed_nft.get('result') or {}
                        
                        target_rec = None
                        if isinstance(result, dict):
                            if str(result.get('nft_address', '')).lower() == clean_addr:
                                target_rec = result
                            else:
                                for k, v in result.items():
                                    if str(k).lower() == clean_addr and isinstance(v, dict):
                                        target_rec = v
                                        break

                        if target_rec:
                            goplus_nft_evidence["evidence_status"] = "VALID"
                            goplus_nft_evidence["identity_match"] = True
                            goplus_nft_evidence["chain_match"] = True
                            goplus_nft_evidence["returned_address"] = clean_addr
                            goplus_nft_evidence["material_fields"] = {
                                "nft_name": target_rec.get('nft_name'),
                                "nft_symbol": target_rec.get('nft_symbol'),
                                "nft_verified": target_rec.get('nft_verified'),
                                "nft_open_source": target_rec.get('nft_open_source'),
                                "privileged_minting": target_rec.get('privileged_minting', {}).get('value') if isinstance(target_rec.get('privileged_minting'), dict) else target_rec.get('privileged_minting'),
                                "malicious_nft_contract": target_rec.get('malicious_nft_contract'),
                            }
                            if target_rec.get('malicious_nft_contract') == 1:
                                goplus_nft_evidence["risk_flags"].append("MALICIOUS_NFT_CONTRACT")
                        else:
                            goplus_nft_evidence["evidence_status"] = "INVALID"
                            goplus_nft_evidence["rejection_reason"] = "NO_RECORD_FOUND_FOR_NFT_ADDRESS"
                    else:
                        goplus_nft_evidence["evidence_status"] = "UNAVAILABLE"
                        goplus_nft_evidence["rejection_reason"] = f"HTTP_ERROR_{nft_resp.status_code}"
                except Exception as e:
                    goplus_nft_evidence["evidence_status"] = "UNAVAILABLE"
                    goplus_nft_evidence["rejection_reason"] = f"FETCH_EXCEPTION_{type(e).__name__}"
            else:
                goplus_nft_evidence["evidence_status"] = "UNAVAILABLE"
                goplus_nft_evidence["rejection_reason"] = "CHAIN_NOT_SUPPORTED_BY_GOPLUS_NFT"

            provider_evidence_list.append(goplus_nft_evidence)

            # ── 4. Parse Birdeye Data (Solana only) ──
            birdeye_evidence = {
                "provider": "birdeye",
                "requested_chain": canonical_chain,
                "requested_chain_id": canonical_chain_id,
                "requested_address": clean_addr,
                "returned_chain": "solana" if is_solana else None,
                "returned_chain_id": "solana" if is_solana else None,
                "returned_address": None,
                "evidence_status": "UNAVAILABLE",
                "identity_match": False,
                "chain_match": False,
                "material_fields": {
                    "name": None,
                    "symbol": None,
                    "liquidity": None,
                },
                "risk_flags": [],
                "rejection_reason": None,
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
                            birdeye_evidence["evidence_status"] = "VALID"
                            birdeye_evidence["identity_match"] = True
                            birdeye_evidence["chain_match"] = True
                            birdeye_evidence["returned_address"] = clean_addr
                            birdeye_evidence["material_fields"] = {
                                "name": data.get('name'),
                                "symbol": data.get('symbol'),
                                "liquidity": data.get('liquidity'),
                            }
                        else:
                            birdeye_evidence["evidence_status"] = "INVALID"
                            birdeye_evidence["rejection_reason"] = "NO_BIRDEYE_DATA"
                    else:
                        birdeye_evidence["evidence_status"] = "UNAVAILABLE"
                        birdeye_evidence["rejection_reason"] = f"HTTP_ERROR_{be_resp.status_code}"
                except Exception as e:
                    birdeye_evidence["evidence_status"] = "UNAVAILABLE"
                    birdeye_evidence["rejection_reason"] = f"FETCH_EXCEPTION_{type(e).__name__}"
            else:
                birdeye_evidence["evidence_status"] = "UNAVAILABLE"
                birdeye_evidence["rejection_reason"] = "PROVIDER_SPECIFIC_TO_SOLANA"

            provider_evidence_list.append(birdeye_evidence)

            # ── 5. Evidence Sufficiency & Identity Resolution ──
            valid_evidences = [
                pe for pe in provider_evidence_list
                if pe["evidence_status"] == "VALID" and pe["identity_match"] and pe["chain_match"]
            ]

            is_evidence_sufficient = len(valid_evidences) > 0

            # Derive resolved identity strictly from valid provider evidence
            resolved_name = "UNKNOWN"
            resolved_symbol = "UNKNOWN"

            for pe in valid_evidences:
                mf = pe.get("material_fields", {})
                cand_name = mf.get("base_token_name") or mf.get("token_name") or mf.get("nft_name") or mf.get("name")
                cand_symbol = mf.get("base_token_symbol") or mf.get("token_symbol") or mf.get("nft_symbol") or mf.get("symbol")
                if cand_name and resolved_name == "UNKNOWN":
                    resolved_name = cand_name
                if cand_symbol and resolved_symbol == "UNKNOWN":
                    resolved_symbol = cand_symbol

            # Aggregated material security fields across providers (missing remain null)
            aggregated_material_fields = {
                "is_honeypot": None,
                "buy_tax": None,
                "sell_tax": None,
                "liquidity_usd": None,
                "liquidity_locked": None,
                "is_open_source": None,
                "is_proxy": None,
                "is_mintable": None,
                "holder_concentration": None,
            }

            for pe in valid_evidences:
                mf = pe.get("material_fields", {})
                if mf.get("is_honeypot") is not None and aggregated_material_fields["is_honeypot"] is None:
                    aggregated_material_fields["is_honeypot"] = mf.get("is_honeypot")
                if mf.get("buy_tax") is not None and aggregated_material_fields["buy_tax"] is None:
                    aggregated_material_fields["buy_tax"] = mf.get("buy_tax")
                if mf.get("sell_tax") is not None and aggregated_material_fields["sell_tax"] is None:
                    aggregated_material_fields["sell_tax"] = mf.get("sell_tax")
                if mf.get("liquidity_usd") is not None and aggregated_material_fields["liquidity_usd"] is None:
                    aggregated_material_fields["liquidity_usd"] = mf.get("liquidity_usd")
                if mf.get("is_open_source") is not None and aggregated_material_fields["is_open_source"] is None:
                    aggregated_material_fields["is_open_source"] = mf.get("is_open_source")

            structured_evidence_payload = {
                "schema_version": "2.0",
                "requested_target": {
                    "address": clean_addr,
                    "chain": canonical_chain,
                    "chain_id": canonical_chain_id,
                },
                "is_evidence_sufficient": is_evidence_sufficient,
                "resolved_identity": {
                    "project_name": resolved_name,
                    "symbol": resolved_symbol,
                    "token_address": clean_addr,
                    "chain": canonical_chain,
                    "chain_id": canonical_chain_id,
                },
                "provider_evidence": provider_evidence_list,
                "material_security_fields": aggregated_material_fields,
                "evidence_rejection_reasons": evidence_rejection_reasons,
            }

            return f"""You are an objective blockchain security consensus validator on GenLayer executing Material Verdict Field Equivalence.

TARGET ADDRESS: {clean_addr}
CANONICAL CHAIN: {canonical_chain} (Chain ID: {canonical_chain_id})

AUTHORITATIVE NORMALIZED PROVIDER EVIDENCE:
{json.dumps(structured_evidence_payload, indent=2)}

STRICT CONSENSUS AND MATERIAL EQUIVALENCE RULES:
1. STRICT CHAIN-MATCHING & IDENTITY:
   - The token/project identity MUST be strictly derived from valid, chain-matched evidence (Name: {resolved_name}, Symbol: {resolved_symbol}).
   - NEVER guess, hallucinate, substitute, or invent a token or project identity.
   - If is_evidence_sufficient is false, the identity MUST remain UNKNOWN.
2. INSUFFICIENT DATA / MISSING EVIDENCE MANDATE:
   - If is_evidence_sufficient is false, you MUST STRICTLY return:
     "verdict": "UNKNOWN",
     "risk_score": null,
     "risk_category": "UNKNOWN",
     "evidence_sufficiency": "INSUFFICIENT",
     "consensus_status": "INSUFFICIENT_EVIDENCE",
     "summary": "Authoritative evidence missing or chain-mismatched. Contract security cannot be verified."
   - NEVER infer safety from missing data. Missing data is UNKNOWN.
3. EVALUATION FOR SUFFICIENT EVIDENCE:
   - If is_evidence_sufficient is true:
     - Check material security fields: is_honeypot, cannot_sell_all, high buy/sell taxes (>20%), malicious functions.
     - If critical threats exist: "verdict": "SCAM" or "RISKY", "risk_category": "HIGH", "risk_score": 75-100.
     - If moderate issues exist: "verdict": "RISKY", "risk_category": "MEDIUM", "risk_score": 40-74.
     - If verified and no malicious patterns detected: "verdict": "SAFE", "risk_category": "LOW", "risk_score": 0-20.
     - "evidence_sufficiency": "SUFFICIENT",
     - "consensus_status": "MAJORITY_AGREE"
4. MISSING VALUES:
   - Any material security field that was not returned by a provider must remain null. Do not convert null to false or 0.

RESPOND EXCLUSIVELY WITH A VALID JSON OBJECT CONFORMING TO SCHEMA 2.0 (no markdown ticks, no commentary):
{{
  "schema_version": "2.0",
  "token_address": "{clean_addr}",
  "chain": "{canonical_chain}",
  "chain_id": "{canonical_chain_id}",
  "verdict": "SAFE" | "RISKY" | "SCAM" | "UNKNOWN",
  "risk_score": <integer 0-100 or null>,
  "risk_category": "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN",
  "summary": "<clear 1-2 sentence evidence-based explanation>",
  "evidence_sufficiency": "SUFFICIENT" | "INSUFFICIENT",
  "consensus_status": "MAJORITY_AGREE" | "MATERIAL_FIELDS_DISAGREE" | "INSUFFICIENT_EVIDENCE" | "IDENTITY_MISMATCH" | "CHAIN_MISMATCH" | "UNKNOWN",
  "identity": {{
    "token_address": "{clean_addr}",
    "chain": "{canonical_chain}",
    "chain_id": "{canonical_chain_id}",
    "project_name": "{resolved_name}",
    "symbol": "{resolved_symbol}"
  }},
  "material_security_fields": {json.dumps(aggregated_material_fields)},
  "core_risk_flags": [],
  "provider_evidence": {json.dumps(provider_evidence_list)},
  "evidence_rejection_reasons": {json.dumps(evidence_rejection_reasons)}
}}
"""

        # Validator consensus configuration with explicit Material Verdict Field Equivalence
        verdict_json_str = gl.eq_principle.prompt_non_comparative(
            build_analysis_prompt,
            task=(
                "Evaluate smart contract security and token identity using authoritative, chain-matched provider evidence. "
                "Produce a normalized Schema 2.0 JSON verdict specifying exact verdict, risk_score, risk_category, identity, "
                "evidence_sufficiency, consensus_status, material_security_fields, and provider_evidence."
            ),
            criteria=(
                "MATERIAL VERDICT FIELD EQUIVALENCE PRINCIPLE: "
                "Two validator outputs are equivalent if and only if all material fields strictly align: "
                "1. TOKEN IDENTITY & CHAIN BINDING: Both outputs must bind to the requested canonical chain ('" + canonical_chain + "') "
                "   and exact token address ('" + clean_addr + "'), with matching project name and symbol (or both agree it is UNKNOWN). "
                "2. FINAL VERDICT: Exact string match on verdict ('SAFE', 'RISKY', 'SCAM', or 'UNKNOWN'). "
                "3. RISK CATEGORY: Exact match on risk_category ('LOW', 'MEDIUM', 'HIGH', or 'UNKNOWN'). "
                "4. RISK SCORE BRACKET: If numeric, scores must differ by no more than 5 points and share the same risk category; "
                "   if insufficient evidence, both must be null. "
                "5. EVIDENCE SUFFICIENCY: Exact match on evidence_sufficiency ('SUFFICIENT' vs 'INSUFFICIENT'). "
                "6. CORE SECURITY DRIVERS: Both outputs must agree on the presence or absence of core risk indicators (honeypot, "
                "   sell restrictions, high taxes, malicious code). "
                "7. PROVIDER EVIDENCE BINDING: Both outputs must agree on the validity status and chain-matching of each evaluated provider. "
                "If material fields conflict, consensus MUST resolve to MATERIAL_FIELDS_DISAGREE."
            )
        )

        self.scan_results[token_address] = verdict_json_str

    @gl.public.view
    def get_scan_result(self, token_address: str) -> str:
        return self.scan_results.get(token_address, "")
