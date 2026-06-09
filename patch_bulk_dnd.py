"""
ATLAS — Patch orphaned bulk_dnd records
========================================
Finds all assessments where source == 'bulk_dnd' and institution_code is
missing, then lets you patch them with the correct workspace key.

Requirements:
    pip install firebase-admin

Usage:
    python patch_bulk_dnd.py                        # dry run — just lists orphans
    python patch_bulk_dnd.py --patch RES-XXXX-YYYY  # patch all orphans with this key
    python patch_bulk_dnd.py --patch RES-XXXX-YYYY --confirm  # actually write to Firebase

You need a Firebase service account JSON file:
    Firebase Console → Project Settings → Service Accounts → Generate New Private Key
    Save it as serviceAccount.json in the same folder as this script.
"""

import json
import sys
import argparse
from datetime import datetime

try:
    import firebase_admin
    from firebase_admin import credentials, db
except ImportError:
    print("ERROR: firebase-admin not installed.")
    print("Run: pip install firebase-admin")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────
DATABASE_URL    = "https://adherence-project-2026-default-rtdb.firebaseio.com"
SERVICE_ACCOUNT = "serviceAccount.json"   # path to your downloaded service account key
# ─────────────────────────────────────────────────────────────────────────────

def init_firebase():
    try:
        cred = credentials.Certificate(SERVICE_ACCOUNT)
        firebase_admin.initialize_app(cred, {"databaseURL": DATABASE_URL})
    except FileNotFoundError:
        print(f"ERROR: Service account file not found: {SERVICE_ACCOUNT}")
        print()
        print("To get it:")
        print("  1. Go to Firebase Console → Project Settings → Service Accounts")
        print("  2. Click 'Generate New Private Key'")
        print("  3. Save the file as 'serviceAccount.json' in the same folder as this script")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR initialising Firebase: {e}")
        sys.exit(1)

def fetch_all_assessments():
    print("Fetching all assessments from Firebase...")
    ref  = db.reference("assessments")
    data = ref.get()
    if not data:
        print("No assessments found in database.")
        return {}
    print(f"  Total records in database: {len(data)}")
    return data

def find_orphans(data):
    """Records where source == bulk_dnd AND institution_code is absent/empty."""
    orphans = {}
    for key, record in data.items():
        if not isinstance(record, dict):
            continue
        source = record.get("source", "")
        code   = (record.get("institution_code") or "").strip()
        if source == "bulk_dnd" and not code:
            orphans[key] = record
    return orphans

def print_orphan_table(orphans):
    if not orphans:
        print("\n✓ No orphaned bulk_dnd records found — all have institution_code set.")
        return

    print(f"\n{'─'*80}")
    print(f"  Found {len(orphans)} orphaned bulk_dnd record(s) with no institution_code:")
    print(f"{'─'*80}")
    header = f"  {'Firebase Key':<24}  {'Patient #':<12}  {'Country':<16}  {'Condition':<20}  {'Uploaded'}"
    print(header)
    print(f"  {'─'*22}  {'─'*12}  {'─'*16}  {'─'*20}  {'─'*20}")

    for key, r in orphans.items():
        ts       = r.get("timestamp", 0)
        uploaded = datetime.fromtimestamp(ts/1000).strftime("%Y-%m-%d %H:%M") if ts else "unknown"
        patient  = str(r.get("patient_number", "—"))[:12]
        country  = str(r.get("country", "—"))[:16]
        cond     = str(r.get("condition", "—"))[:20]
        print(f"  {key:<24}  {patient:<12}  {country:<16}  {cond:<20}  {uploaded}")

    print(f"{'─'*80}")

def patch_orphans(orphans, workspace_key, confirm=False):
    if not orphans:
        return

    ws = workspace_key.strip().upper()
    print(f"\n  Workspace key to apply: {ws}")

    if not confirm:
        print("\n  ⚠  DRY RUN — no changes written.")
        print("     Add --confirm to actually patch Firebase.")
        return

    print(f"\n  Patching {len(orphans)} record(s)...")
    patched = 0
    failed  = 0
    for key, record in orphans.items():
        try:
            db.reference(f"assessments/{key}").update({
                "institution_code": ws
            })
            pid = record.get("patient_number", key)
            print(f"    ✓ {key}  (patient: {pid})")
            patched += 1
        except Exception as e:
            print(f"    ✗ {key}  ERROR: {e}")
            failed += 1

    print(f"\n  Done — {patched} patched, {failed} failed.")

def main():
    parser = argparse.ArgumentParser(
        description="Find and patch orphaned bulk_dnd records in ATLAS Firebase."
    )
    parser.add_argument(
        "--patch",
        metavar="WORKSPACE_KEY",
        help="Workspace key to stamp onto orphaned records (e.g. RES-XXXX-YYYY-2026)"
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Actually write to Firebase (omit for a dry run)"
    )
    parser.add_argument(
        "--all-bulk",
        action="store_true",
        help="Show ALL bulk_dnd records, not just orphans"
    )
    args = parser.parse_args()

    init_firebase()
    data    = fetch_all_assessments()
    orphans = find_orphans(data)

    if args.all_bulk:
        # Show every bulk_dnd record regardless of institution_code
        all_bulk = {k: v for k, v in data.items()
                    if isinstance(v, dict) and v.get("source") == "bulk_dnd"}
        print(f"\n  All bulk_dnd records ({len(all_bulk)} total, {len(orphans)} orphaned):")
        for key, r in all_bulk.items():
            code = r.get("institution_code") or "⚠ MISSING"
            pid  = r.get("patient_number", "—")
            print(f"    {key}  patient={pid}  institution_code={code}")

    print_orphan_table(orphans)

    if args.patch:
        patch_orphans(orphans, args.patch, confirm=args.confirm)
    elif orphans:
        print("\n  To patch these records, run:")
        print("    python patch_bulk_dnd.py --patch YOUR-WORKSPACE-KEY --confirm")

if __name__ == "__main__":
    main()
