# DarkTrace Threat Intelligence Platform 2.1

Educational SOC-style threat-intelligence dashboard supporting 2–8 entities.

## Architecture
Multiple Data Sources → Data Ingestion → Normalization → Entity Extraction → Relationship Matching & Scoring → Anomaly/Risk Indicator → Blockchain Audit → Backend API → Dashboard → Interactive Graph → Investigation & Reports

## Integrated sources
- Wikidata — entity resolution and structured relationships
- MITRE ATT&CK — actor aliases, malware/tools, techniques and campaign relationships when the resolved name matches ATT&CK
- CISA KEV — current known-exploited-vulnerability context
- GDELT — recent public-news co-mention signal

Source requests are cached, fail-soft where possible, and source URLs/timestamps are retained in analysis data. The application does not treat a co-mention as proof of attribution.

## Graph
- Up to 8 analyzed entities remain in the backend result.
- Default **Focus** mode displays the strongest four entities to reduce clutter; nothing is deleted.
- **All 8** reveals every analyzed entity.
- Relationship scores are displayed on graph edges.
- Edge colors: Weak 0–24, Moderate 25–49, Strong 50–74, Very strong 75–100.
- Drag nodes, freeze/resume physics, zoom, pan, reset, search visible nodes and fullscreen the graph.

## Blockchain audit
Every investigation creates a versioned hash-linked audit block in `audit_chain.json`. Verify Blockchain checks block indexes, previous hashes and block hashes. If a real mismatch exists, the response identifies the affected block and expected/actual hash; the UI marks that block invalid/glitched and reports **Chain Integrity Compromised**. Older ledgers are classified as **Legacy**, not falsely labelled as tampered. **Initialize New Ledger** archives the legacy chain before starting a clean v2.1 ledger. No random tamper state is generated.

## Reports
- JSON export
- CSV relationship export
- PNG graph export
- PDF-ready investigation report via the browser print dialog

## Run
1. Install dependencies: `pip install -r requirements.txt`
2. Run: `python app.py`
3. Open: `http://127.0.0.1:5000`

For deployment, keep secrets in environment variables and use a production WSGI server. This educational build uses public endpoints and does not require API keys.

## Visual system
- Near-black SOC dashboard with cyan primary accent, purple analysis/AI accent, green verified state, amber warnings and red threat/integrity state.
- Entity nodes are visually typed; relationship edges are animated and color-coded by score.
- Edge scores remain visible as 0–100% labels in the graph.
- Blockchain cards show block index, timestamp and shortened hash, with a clear verified/compromised state.
