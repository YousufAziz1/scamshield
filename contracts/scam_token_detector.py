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

        # Fetch all external data and build a rich prompt for the AI
        # Using prompt_non_comparative so only the leader validator fetches web data;
        # other validators verify the AI output meets the criteria instead of re-running fetches.
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

            # ── 2. GoPlus Security (EVM chains only) ──
            goplus_data = '{}'
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
                            goplus_data = body[:3000]
                except Exception:
                    pass

            # ── 3. Birdeye (Solana only — better coverage than GoPlus) ──
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
                dex_data not in ('{}', '') or
                goplus_data not in ('{}', '') or
                birdeye_data not in ('{}', '')
            )

            data_section = f"""
=== DexScreener Data ===
{dex_data}

=== GoPlus Security Data ===
{goplus_data}
"""
            if is_solana:
                data_section += f"""
=== Birdeye Solana Data ===
{birdeye_data}
"""

            fallback_note = ""
            if not has_live_data:
                fallback_note = """
NOTE: No live API data was retrieved. Use your training knowledge about this specific
token address and name to determine the verdict. Do NOT default to RISKY or SCAM
simply because API data is unavailable.
"""

            return f"""You are a blockchain security expert specializing in token scam detection.

Token Address : {token_address}
Chain         : {chain_id}

{data_section}
{fallback_note}

INSTRUCTIONS:
1. Analyze the token using BOTH the API data above AND your prior knowledge.
2. Well-known legitimate tokens (USDC, USDT, WETH, WBTC, BNB, UNI, LAYER/Solayer,
   SOL, ETH, MATIC, ARB, etc.) must be marked SAFE with a low riskScore (0-20).
3. Only mark SCAM or RISKY if the data explicitly shows scam indicators such as:
   - Honeypot (cannot sell, extreme buy/sell tax)
   - Blacklist functions targeting holders
   - Minting authority abused after launch
   - Rug-pull: LP removed / unlocked
   - Clone of a well-known project with a deceptive name
4. If truly no information exists, return UNKNOWN with riskScore 50.

RESPOND ONLY with valid JSON — no markdown, no extra text:
{{
  "verdict": "SAFE" | "RISKY" | "SCAM" | "UNKNOWN",
  "riskScore": <integer 0-100>,
  "summary": "<2-sentence explanation of the verdict>",
  "flags": [
    {{
      "id": "<short_snake_case_id>",
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "label": "<short flag name>",
      "detail": "<one sentence explanation>"
    }}
  ]
}}
"""

        # Validators verify the JSON structure and that legitimate tokens aren't wrongly flagged
        verdict_json_str = gl.eq_principle.prompt_non_comparative(
            build_analysis_prompt,
            task=(
                "Analyze the token security using the provided API data and your training knowledge. "
                "Return a structured JSON verdict with verdict, riskScore, summary, and flags."
            ),
            criteria=(
                "The response must be valid JSON containing: "
                "verdict (one of SAFE/RISKY/SCAM/UNKNOWN), "
                "riskScore (integer 0-100), "
                "summary (non-empty string), "
                "flags (array, may be empty). "
                "Well-known legitimate tokens (USDC, USDT, WETH, BNB, UNI, LAYER, etc.) "
                "must have verdict SAFE and riskScore <= 25 unless clear scam data is present."
            )
        )

        self.scan_results[token_address] = verdict_json_str

    @gl.public.view
    def get_scan_result(self, token_address: str) -> str:
        return self.scan_results.get(token_address, "")
