"""Official Indian Intellectual Property Statutory Fee Calculator.

Accurately implements The First Schedule of The Patents Rules, 2003 (as amended by
Patent (Amendment) Rules, 2024), The Trade Marks Rules, 2017, and The Designs Rules, 2001.
"""

from __future__ import annotations

from typing import Any


def calculate_ip_fee(
	ip_type: str,
	applicant_type: str,
	filing_mode: str = "online",
	is_provisional: bool = False,
	pages_count: int = 30,
	claims_count: int = 10,
	include_early_publication: bool = False,
	request_examination: str = "none",  # "none", "standard" (Form 18), "expedited" (Form 18A)
	trademark_classes_count: int = 1,
) -> dict[str, Any]:
	"""Calculate statutory government fees in INR (₹) according to Indian IP official schedules."""
	ip_type = ip_type.lower().strip()
	applicant_type = applicant_type.lower().strip()
	filing_mode = filing_mode.lower().strip()
	request_examination = request_examination.lower().strip()

	# Validate applicant category
	# Natural Person, Startup, Small Entity, and Educational Institution receive 80% fee rebate under Indian rules
	is_rebate_eligible = applicant_type in {
		"natural_person",
		"individual",
		"startup",
		"small_entity",
		"educational_institution",
	}

	is_online = filing_mode != "physical"

	breakdown = []
	applicable_forms = []
	total_fee = 0.0

	if ip_type in {"patent", "patents"}:
		# 1. Filing Application (Form 1 + Form 2)
		applicable_forms.extend(["Form 1 (Application for Grant of Patent)", "Form 2 (Provisional/Complete Specification)"])
		if is_rebate_eligible:
			base_filing_fee = 1600 if is_online else 1750
			desc = "Form 1 & 2 Base Filing Fee (Individual/Startup/Small Entity 80% Rebate)"
		else:
			base_filing_fee = 8000 if is_online else 8800
			desc = "Form 1 & 2 Base Filing Fee (Large Entity / Others)"

		breakdown.append({
			"item": desc,
			"fee_inr": base_filing_fee,
			"rule": "The First Schedule, Entry 1",
		})
		total_fee += base_filing_fee

		# Extra pages fee (above 30 pages)
		if pages_count > 30:
			extra_pages = pages_count - 30
			rate_per_page = 160 if is_rebate_eligible else 800
			extra_pages_fee = extra_pages * rate_per_page
			breakdown.append({
				"item": f"Extra Specification Pages ({extra_pages} pages @ ₹{rate_per_page}/page)",
				"fee_inr": extra_pages_fee,
				"rule": "The First Schedule, Entry 1 Note",
			})
			total_fee += extra_pages_fee

		# Extra claims fee (above 10 claims)
		if not is_provisional and claims_count > 10:
			extra_claims = claims_count - 10
			rate_per_claim = 320 if is_rebate_eligible else 1600
			extra_claims_fee = extra_claims * rate_per_claim
			breakdown.append({
				"item": f"Extra Claims ({extra_claims} claims @ ₹{rate_per_claim}/claim)",
				"fee_inr": extra_claims_fee,
				"rule": "The First Schedule, Entry 1 Note",
			})
			total_fee += extra_claims_fee

		# 2. Early Publication (Form 9)
		if include_early_publication:
			applicable_forms.append("Form 9 (Request for Early Publication)")
			early_pub_fee = 2500 if is_rebate_eligible else 12500
			breakdown.append({
				"item": "Form 9: Request for Early Publication (Published within 1 month)",
				"fee_inr": early_pub_fee,
				"rule": "Rule 24A, The First Schedule Entry 8",
			})
			total_fee += early_pub_fee

		# 3. Request for Examination (Form 18 / Form 18A)
		if request_examination == "standard":
			applicable_forms.append("Form 18 (Request for Standard Examination)")
			rfe_fee = 4000 if is_rebate_eligible else 20000
			breakdown.append({
				"item": "Form 18: Standard Request for Examination",
				"fee_inr": rfe_fee,
				"rule": "Rule 24B, The First Schedule Entry 11",
			})
			total_fee += rfe_fee
		elif request_examination == "expedited":
			applicable_forms.append("Form 18A (Request for Expedited Examination)")
			# Expedited examination is permitted for Startups, Small Entities, Female Applicants, Government Depts
			rfe_exp_fee = 8000 if is_rebate_eligible else 60000
			breakdown.append({
				"item": "Form 18A: Expedited Examination (Fast-track disposal)",
				"fee_inr": rfe_exp_fee,
				"rule": "Rule 24C, The First Schedule Entry 11A",
			})
			total_fee += rfe_exp_fee

		notes = [
			"Official e-filing receives a 10% discount compared to physical paper filing at Patent Offices.",
			"Startups and Individuals enjoy an 80% statutory fee reduction across all prosecution stages.",
			"Form 3 (Statement & Undertaking) and Form 5 (Declaration as to Inventorship) have ₹0 statutory fee if filed within prescribed timelines.",
		]

	elif ip_type in {"trademark", "trademarks"}:
		# Form TM-A (Application for Registration of Trademark)
		applicable_forms.append("Form TM-A (Application for Trademark Registration)")
		classes = max(1, trademark_classes_count)
		if is_rebate_eligible:
			fee_per_class = 4500 if is_online else 5000
			desc = f"Form TM-A ({classes} class{'es' if classes > 1 else ''}) - Individual/Startup"
		else:
			fee_per_class = 9000 if is_online else 10000
			desc = f"Form TM-A ({classes} class{'es' if classes > 1 else ''}) - Large Entity"

		tm_fee = fee_per_class * classes
		breakdown.append({
			"item": desc,
			"fee_inr": tm_fee,
			"rule": "First Schedule of Trade Marks Rules, 2017 Entry 1",
		})
		total_fee += tm_fee

		notes = [
			"Trademark online e-filing via ipindiaonline.gov.in provides a 10% statutory discount.",
			"Trademark protection lasts 10 years and is renewable indefinitely every 10 years via Form TM-R.",
		]

	elif ip_type in {"design", "designs"}:
		applicable_forms.append("Form 1 (Application for Registration of Design)")
		if is_rebate_eligible:
			design_fee = 1000 if is_online else 1100
		else:
			design_fee = 4000 if is_online else 4400

		breakdown.append({
			"item": "Form 1: Design Application Filing Fee",
			"fee_inr": design_fee,
			"rule": "The Designs Rules, 2001 (First Schedule)",
		})
		total_fee += design_fee
		notes = [
			"Registered designs protect novel aesthetic shapes and visual patterns for 10 years (extendable to 15).",
		]

	else:
		return {
			"error": f"Unsupported IP type '{ip_type}'. Supported types: 'patent', 'trademark', 'design'."
		}

	return {
		"ip_type": ip_type.capitalize(),
		"applicant_type": applicant_type.replace("_", " ").title(),
		"filing_mode": "Online (e-Filing)" if is_online else "Physical (Paper Filing)",
		"total_fee_inr": total_fee,
		"rebate_applied": "80% Statutory Subsidy" if is_rebate_eligible else "Standard Large Entity Rate",
		"breakdown": breakdown,
		"applicable_forms": applicable_forms,
		"statutory_notes": notes,
	}
