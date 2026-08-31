# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

class ScamTokenDetector(gl.Contract):
    scan_results: TreeMap[str, str]

    def __init__(self):
        pass

    @gl.public.write
    def scan_token(self, token_address: str, chain_id: str) -> None:
        # Supported chains and their API identifiers
        supported_chains = {
            'ethereum': {'goplus': '1', 'dex': 'ethereum'},
            'bsc':      {'goplus': '56', 'dex': 'bsc'},
            'polygon':  {'goplus': '137', 'dex': 'polygon'},
            'arbitrum': {'goplus': '42161', 'dex': 'arbitrum'},
            'base':     {'goplus': '8453', 'dex': 'base'},
            'solana':   {'goplus': 'solana', 'dex': 'solana'},
        }

        cfg = supported_chains.get(chain_id.lower(), {'goplus': '1', 'dex': 'ethereum'})
        is_solana = chain_id.lower() == 'solana'

        # Fetch external market and security data for validator consensus prompt
        def build_analysis_prompt() -> str:
            # ── 1. DexScreener (all chains) ──
            dex_data = '{}'
            try:
                dex_url = f"https://api.dexscreener.com/latest/dex/tokens/{token_address}"
                dex_resp = gl.nondet.web.get(dex_url)
                if dex_resp.status_code == 200:
                    body = dex_resp.body.decode('utf-8')
                    if len(body) > 20:
                        dex_data = body[:4000]
            except Exception:
                pass

            # ── 2. GoPlus Token Security (EVM chains) ──
            goplus_token_data = '{}'
            if not is_solana:
                try:
                    gp_url = (
                        f"https://api.gopluslabs.io/api/v1/token_security/{cfg['goplus']}"
                        f"?contract_addresses={token_address}"
                    )
                    gp_resp = gl.nondet.web.get(gp_url)
                    if gp_resp.status_code == 200:
                        body = gp_resp.body.decode('utf-8')
                        if len(body) > 20:
                            goplus_token_data = body[:3000]
                except Exception:
                    pass

            # ── 3. GoPlus NFT Security (EVM chains) ──
            goplus_nft_data = '{}'
            if not is_solana:
                try:
                    nft_url = (
                        f"https://api.gopluslabs.io/api/v1/nft_security/{cfg['goplus']}"
                        f"?contract_addresses={token_address}"
                    )
                    nft_resp = gl.nondet.web.get(nft_url)
                    if nft_resp.status_code == 200:
                        body = nft_resp.body.decode('utf-8')
                        if len(body) > 20:
                            goplus_nft_data = body[:3000]
                except Exception:
                    pass

            # ── 4. Birdeye (Solana only) ──
            birdeye_data = '{}'
            if is_solana:
                try:
                    be_url = f"https://public-api.birdeye.so/public/token_overview?address={token_address}"
                    be_resp = gl.nondet.web.get(be_url)
                    if be_resp.status_code == 200:
                        body = be_resp.body.decode('utf-8')
                        if len(body) > 20:
                            birdeye_data = body[:3000]
                except Exception:
                    pass

            has_live_data = (
                dex_data not in ('{}', '', '{"schemaVersion":"1.0.0","pairs":null}') or
                goplus_token_data not in ('{}', '', '{"code":1,"message":"OK","result":{}}') or
                goplus_nft_data not in ('{}', '', '{"code":1,"message":"OK","result":{}}') or
                birdeye_data not in ('{}', '')
            )

            data_section = f"""
=== DexScreener Market Data ===
{dex_data}

=== GoPlus Token Security Data ===
{goplus_token_data}

=== GoPlus NFT Security Data ===
{goplus_nft_data}
"""
            if is_solana:
                data_section += f"""
=== Birdeye Solana Data ===
{birdeye_data}
"""

            fallback_note = ""
            if not has_live_data:
                fallback_note = """
CRITICAL NOTICE: No authoritative market or contract metadata was found for this contract address on the specified network.
You MUST strictly return VERDICT "UNKNOWN" with riskScore 50.
Do NOT guess or substitute the identity of any other token or project.
"""

            return f"""You are an objective blockchain security analyst validating contract parameters and token threats.

Target Contract Address : {token_address}
Target Network / Chain : {chain_id}

{data_section}
{fallback_note}

STRICT ANALYSIS RULES:
1. Verify the contract address strictly against the target network ({chain_id}).
2. Token/project identity MUST be derived exclusively from the authoritative contract/network metadata provided above.
3. NEVER substitute another token or project name when identity resolution fails or when data is missing.
4. If no authoritative metadata or active liquidity exists on the target network, return VERDICT "UNKNOWN", riskScore 50, and summary "Unable to verify token identity or security parameters. No authoritative market or contract metadata found on the selected network."
5. If the contract is a verified token or NFT with no malicious indicators, return VERDICT "SAFE" with an appropriate low risk score.
6. Only return "SCAM" or "RISKY" if clear malicious parameters are present (such as honeypots, transfer blocks, malicious NFT logic, or 100% sell tax).

RESPOND EXCLUSIVELY WITH VALID JSON (no markdown formatting, no commentary):
{{
  "verdict": "SAFE" | "RISKY" | "SCAM" | "UNKNOWN",
  "riskScore": <integer 0-100>,
  "summary": "<clear 1-2 sentence explanation of the finding>",
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

        # Validator consensus configuration
        verdict_json_str = gl.eq_principle.prompt_non_comparative(
            build_analysis_prompt,
            task=(
                "Analyze token and smart contract security using retrieved network and security data. "
                "Output a strictly formatted JSON verdict containing verdict, riskScore, summary, and flags."
            ),
            criteria=(
                "The output must be strictly valid JSON with: "
                "verdict (one of 'SAFE', 'RISKY', 'SCAM', 'UNKNOWN'), "
                "riskScore (integer between 0 and 100), "
                "summary (non-empty descriptive string), and "
                "flags (list of flag objects). "
                "Identity and security evaluation must be derived strictly from the provided contract metadata on the selected chain. "
                "If metadata is missing or unverified, the verdict MUST be UNKNOWN with riskScore 50. "
                "Never substitute another project's identity."
            )
        )

        self.scan_results[token_address] = verdict_json_str

    @gl.public.view
    def get_scan_result(self, token_address: str) -> str:
        return self.scan_results.get(token_address, "")
