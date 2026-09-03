# 🛡️ ScamShield AI — Decentralized Token Threat Detection Console

ScamShield AI is an enterprise-grade Web3 security intelligence and threat detection console powered by **GenLayer Intelligent Contracts** and decentralized validator consensus on StudioNet. It detects honeypots, rug pulls, hidden mint vectors, and high-tax traps in real time by executing on-chain consensus over authoritative, strictly chain-matched security provider evidence.

<p align="center">
  <img src="./public/logo.jpg" alt="ScamShield Logo" width="160" style="border-radius: 50%; box-shadow: 0 0 24px rgba(0, 255, 204, 0.4);" />
</p>

---

## 1. Authoritative Evidence Flow

Unlike client-side scanners that make security heuristics in the user's browser, ScamShield delegates the entirety of evidence retrieval, normalization, and evaluation to the **GenLayer Intelligent Contract** (`contracts/scam_token_detector.py`).

```
┌────────────────────────────────────────────────────────┐
│ 1. User signs scan_token(address, chain) on GenLayer   │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ 2. GenLayer Validator Committee executes Python IC     │
│    - DexScreener Web API (/tokens/{address})           │
│    - GoPlus Token Security Web API (/token_security)   │
│    - GoPlus NFT Security Web API (/nft_security)       │
│    - Birdeye Token Overview (Solana specific)          │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ 3. On-Contract Evidence Parsing & Chain Bounding       │
│    - Normalize address to lowercase                    │
│    - Resolve canonical chain identifier & ID           │
│    - Discard mismatched pairs or cross-chain tokens    │
│    - Discard pair contract address substitutions       │
│    - Form normalized ProviderEvidence list             │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ 4. Material Verdict Field Equivalence Consensus        │
│    gl.eq_principle.prompt_non_comparative              │
│    - Identity & Chain Binding                          │
│    - Core Verdict & Risk Category Matching             │
│    - Score Bracket Tolerance (<= 5 pts)                │
│    - Core Security Drivers Agreement                   │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ 5. Schema 2.0 Verdict Persisted On-Chain               │
│    - Stored in self.scan_results[token_address]        │
│    - Read via get_scan_result(token_address)           │
│    - Frontend renders verified telemetry               │
└────────────────────────────────────────────────────────┘
```

---

## 2. Exact Chain-Matching Rules

ScamShield enforces strict, deterministic chain-matching in the contract before provider data can be admitted as evidence:

1. **Canonical Chain Registry**:
   - `ethereum`, `eth`, `ethereum-mainnet`, `1` → Canonical Chain: `ethereum` / Chain ID: `1`
   - `bsc`, `binance`, `binance-smart-chain`, `56` → Canonical Chain: `bsc` / Chain ID: `56`
   - `polygon`, `matic`, `137` → Canonical Chain: `polygon` / Chain ID: `137`
   - `arbitrum`, `arb`, `42161` → Canonical Chain: `arbitrum` / Chain ID: `42161`
   - `base`, `8453` → Canonical Chain: `base` / Chain ID: `8453`
   - `solana`, `sol` → Canonical Chain: `solana` / Chain ID: `solana`
2. **Address Matching**:
   - EVM addresses are strictly normalized to lowercase (`clean_addr = token_address.strip().lower()`).
   - The provider's returned `baseToken.address` must match `clean_addr` exactly.
   - **No Pair Address Substitution**: If a provider pair record has `pairAddress == clean_addr` but `baseToken.address != clean_addr`, the evidence is immediately flagged `INVALID / ADDRESS MISMATCH` and rejected.
3. **Chain Matching**:
   - The provider's returned `chainId` must match the canonical chain identifier (`chain_info['dex']` / `chain_info['goplus']`).
   - Pairs found on another chain (e.g. cross-chain bridged pools) are rejected with `CHAIN_MISMATCH: Pairs found only on non-requested chains`.
4. **No Name/Symbol-Only Matching**:
   - Matches are never accepted based on token symbol or name alone.

---

## 3. Normalized Verdict Schema (Schema 2.0)

Every validator execution and on-chain result adheres to the versioned `Schema 2.0` specification:

```json
{
  "schema_version": "2.0",
  "token_address": "0x5510cd555b0ae386b420421a7ad98c6785499983",
  "chain": "ethereum",
  "chain_id": "1",
  "verdict": "SAFE | RISKY | SCAM | UNKNOWN",
  "risk_score": 12,
  "risk_category": "LOW | MEDIUM | HIGH | UNKNOWN",
  "summary": "Objective security summary verified by validator consensus.",
  "evidence_sufficiency": "SUFFICIENT | INSUFFICIENT",
  "consensus_status": "MAJORITY_AGREE | MATERIAL_FIELDS_DISAGREE | INSUFFICIENT_EVIDENCE | IDENTITY_MISMATCH | CHAIN_MISMATCH | UNKNOWN",
  "identity": {
    "token_address": "0x5510cd555b0ae386b420421a7ad98c6785499983",
    "chain": "ethereum",
    "chain_id": "1",
    "project_name": "Wingston by Rally",
    "symbol": "WNGST"
  },
  "provider_evidence": [
    {
      "provider": "dexscreener",
      "requested_chain": "ethereum",
      "requested_address": "0x5510cd555b0ae386b420421a7ad98c6785499983",
      "returned_chain": "ethereum",
      "returned_address": "0x5510cd555b0ae386b420421a7ad98c6785499983",
      "identity_match": true,
      "chain_match": true,
      "evidence_status": "VALID",
      "material_fields": {
        "price_usd": "0.05",
        "liquidity_usd": 125000,
        "fdv_usd": 500000
      },
      "risk_flags": [],
      "rejection_reason": null
    }
  ],
  "material_security_fields": {
    "is_honeypot": "0",
    "buy_tax": "0.01",
    "sell_tax": "0.01",
    "liquidity_usd": 125000,
    "liquidity_locked": null,
    "is_open_source": "1",
    "is_proxy": null,
    "is_mintable": null,
    "holder_concentration": null
  },
  "core_risk_flags": [],
  "evidence_rejection_reasons": [],
  "genlayer_telemetry": {
    "transaction_hash": "0x411a919eb85ecc6303d74c3f17272fdf78db2fda552048bf249cca9f58e3b1cd",
    "num_of_rounds": 1,
    "round_validators": ["0x98519402C343C310f9f08331BB85b51790856B55", "..."],
    "votes_committed": 5,
    "votes_revealed": 5,
    "validator_votes_name": ["AGREE", "AGREE", "AGREE", "AGREE", "AGREE"],
    "consensus_result": "MAJORITY_AGREE",
    "execution_status": "FINALIZED"
  }
}
```

---

## 4. Material Verdict Fields Used for Consensus Comparison

In `gl.eq_principle.prompt_non_comparative`, validator outputs are judged equivalent if and only if all material security fields align:

1. **Token Identity & Chain Binding**: Exact normalized address and canonical chain match (or both outputs agree identity is `UNKNOWN`).
2. **Final Verdict**: Exact match on `SAFE`, `RISKY`, `SCAM`, or `UNKNOWN`.
3. **Risk Category**: Exact match on `LOW`, `MEDIUM`, `HIGH`, or `UNKNOWN`.
4. **Risk Score Bracket**: Numeric scores must differ by no more than ±5 points and share the same category; when evidence is insufficient, both scores must be `null`.
5. **Evidence Sufficiency**: Exact match on `SUFFICIENT` vs `INSUFFICIENT`.
6. **Core Security Drivers**: Agreement on critical flags (`is_honeypot`, `cannot_sell_all`, high taxes > 20%, malicious functions).
7. **Provider Evidence Binding**: Agreement on the validity and chain-match status of queried providers.

---

## 5. Security & Consensus Glossary

| Term | Meaning |
| :--- | :--- |
| `SAFE` | Contract parameters verified on-chain with no honeypot, sell lock, or high tax anomalies detected. |
| `RISKY` | Moderate threat indicators identified (e.g. elevated transfer tax, unrenounced owner control permissions). |
| `SCAM` | Critical threat pattern confirmed (e.g. honeypot bytecode, 100% sell tax, blocked transfer liquidity). |
| `UNKNOWN` | Authoritative evidence was unavailable, chain-mismatched, or incomplete. Security cannot be verified. |
| `SUFFICIENT` | At least one authoritative provider returned valid, chain-matched, and address-matched evidence. |
| `INSUFFICIENT` | No valid chain-matched provider evidence was found. Never converted into a positive or safe verdict. |
| `MAJORITY_AGREE` | The validator committee achieved BFT quorum with matching material verdict fields. |
| `MATERIAL_FIELDS_DISAGREE` | Validators reached divergence on core security fields, score brackets, or verdicts. |
| `CHAIN_MISMATCH` | Evidence was retrieved for a different chain than the user requested and was discarded. |
| `IDENTITY_MISMATCH` | Provider returned data for a different token address than the target address. |

---

## 6. Real GenLayer Telemetry vs Unavailable Fields

### Telemetry Fields Displayed When Returned:
- **`round_validators`**: Authentic hexadecimal addresses of validators assigned to the execution committee.
- **`votes_committed` / `votes_revealed`**: Actual count of voting commits and reveals recorded on-chain.
- **`validator_votes_name`**: Real votes cast (`AGREE`, `IDLE`, etc.).
- **`num_of_rounds`**: Actual consensus rounds executed.
- **`consensus_result`**: Result name returned by GenLayer (`MAJORITY_AGREE`, `INSUFFICIENT_EVIDENCE`, etc.).
- **`transaction_hash`**: On-chain hash broadcast to GenLayer StudioNet.

### Fields Intentionally Displayed as "Unavailable":
- If the current GenLayer node or SDK does not expose validator committee identities for a transaction round, the interface displays: `Unavailable` or `N/A — Validator identities not published in round metadata.`
- If a token has `verdict: "UNKNOWN"`, the risk gauge displays `--` (null score) instead of a fabricated 50%.
- If a provider is not queried or returns an error, its status is explicitly rendered as `UNAVAILABLE`.

---

## 7. Zero Synthetic Telemetry Guarantee

> [!IMPORTANT]
> **ScamShield does not fabricate or simulate validator consensus in production**:
> - 0 hardcoded node counts (no fake "1,402" or "20 Validators").
> - 0 mascot nicknames (no BEAR-NODE, FOX-NODE, etc.).
> - 0 fake BFT quorum percentages (no synthetic ">66.7%").
> - 0 fake confidence scores (no "98.4% Confidence").
> - When idle, the system displays `Status: READY`, neutral `--` gauge, and truthful session metrics.

---

## 8. Deployment & Contract Upgrade Instructions

### Network Configuration
- **Network**: GenLayer Studio Network (Chain ID: `61999` / `0xf22f`)
- **RPC URL**: `https://studio.genlayer.com/api`
- **Intelligent Contract Address**: `0x5802c5AE337b7c79723beC9d0017C32DCAec12b7`

### Upgrading the Intelligent Contract
1. Modify `contracts/scam_token_detector.py`.
2. Deploy the contract using the GenLayer CLI or Studio interface:
   ```bash
   # Deploy Python Intelligent Contract to StudioNet
   genlayer deploy --contract contracts/scam_token_detector.py --network studionet
   ```
3. Update `.env`:
   ```env
   VITE_CONTRACT_ADDRESS="<new_contract_address>"
   VITE_GENLAYER_RPC="https://studio.genlayer.com/api"
   ```
4. Verify the build and deploy the frontend:
   ```bash
   npx tsc --noEmit
   npm run lint
   npx vitest run
   npm run build
   ```

---

## 9. Verification & Reviewer Test Case

- **Target Network**: Ethereum
- **Contract Address**: `0x5510cd555b0ae386b420421a7ad98c6785499983` (Rally NFT)
- **Live Transaction Proof**: `0x411a919eb85ecc6303d74c3f17272fdf78db2fda552048bf249cca9f58e3b1cd`
- **Expected Identity**: `Wingston by Rally` (`WNGST`) or `UNKNOWN` (Never Solayer / LAYER).
- **Consensus Result**: `MAJORITY_AGREE` (5 GenLayer validators).

---

## 👤 Developer
Built with 💚 by Yousuf — Indie Hacker & AI SaaS Builder.
