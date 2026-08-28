"""Test alternative variations of all 25 statutory FAQs."""

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


def test_alternative_faqs():
    with open("backend/data/faqs.json", "r", encoding="utf-8") as f:
        faqs = json.load(f)

    total_variants = 0
    passed_variants = 0

    print("==================================================")
    print("Testing all alternative FAQ query variations...")
    print("==================================================")

    for faq in faqs:
        fid = faq["id"]
        alts = faq.get("alternative_questions", [])
        for alt_q in alts:
            total_variants += 1
            res = answer_question(alt_q)
            ans = res.get("answer", "")
            is_valid = "I can only assist with" not in ans and "Request rejected" not in ans
            if is_valid:
                passed_variants += 1
                print(f"[PASS] [{fid}] '{alt_q}'")
            else:
                print(f"[FAIL] [{fid}] '{alt_q}'")

    print("\n==================================================")
    print(f"ALTERNATIVE VARIATIONS RESULT: {passed_variants}/{total_variants} passed!")
    print("==================================================")


if __name__ == "__main__":
    test_alternative_faqs()
