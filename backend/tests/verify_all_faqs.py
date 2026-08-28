"""Automated verification script to validate all 25 statutory FAQs."""

from __future__ import annotations
import sys
import json
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.rag.generate import answer_question


def test_all_faqs():
    with open("backend/data/faqs.json", "r", encoding="utf-8") as f:
        faqs = json.load(f)

    print("==================================================")
    print(f"Testing all {len(faqs)} Statutory FAQs against RAG Engine...")
    print("==================================================")

    passed = 0
    failed = []

    for faq in faqs:
        fid = faq["id"]
        q = faq["question"]
        res = answer_question(q)
        is_from_faq = res.get("from_faq", False)
        answer = res.get("answer", "")

        is_valid = is_from_faq and "I can only assist with" not in answer and "Request rejected" not in answer

        if is_valid:
            passed += 1
            print(f"[PASS] [{fid}] {q}")
        else:
            failed.append((fid, q, answer[:100]))
            print(f"[FAIL] [{fid}] {q} -> Unexpected output: {answer[:80]}...")

    print("\n==================================================")
    print(f"FINAL RESULT: {passed}/{len(faqs)} FAQs verified successfully!")
    print("==================================================")

    if failed:
        print(f"Issues detected in {len(failed)} FAQs:")
        for item in failed:
            print(f" - {item[0]}: {item[1]}")
    else:
        print("ALL 25 STATUTORY FAQS PASSED WITH 100% SUCCESS!")


if __name__ == "__main__":
    test_all_faqs()
