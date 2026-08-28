"""Patentability Assessment Wizard ('Am I Patentable?').

Evaluates inventions against Indian statutory non-patentability bars under Section 3
of The Patents Act, 1970 and Section 6 of the Biological Diversity Act, 2002.
"""

from __future__ import annotations

from typing import Any


def assess_patentability(
	title: str,
	description: str,
	is_ayurvedic_or_herbal: bool = False,
	is_combination_of_known_herbs_or_drugs: bool = False,
	has_synergistic_efficacy_data: bool = False,
	uses_indian_biological_resources: bool = False,
	is_method_of_treatment: bool = False,
	publicly_disclosed_before_filing: bool = False,
) -> dict[str, Any]:
	"""Evaluate invention feasibility score and identify statutory hurdles."""
	score = 100
	hurdles: list[dict[str, str]] = []
	recommendations: list[str] = []
	clearances_required: list[str] = []

	# 1. Section 3(p) - Traditional Knowledge & TKDL Bar
	if is_ayurvedic_or_herbal:
		if is_combination_of_known_herbs_or_drugs and not has_synergistic_efficacy_data:
			score -= 40
			hurdles.append({
				"section": "Section 3(p) of The Patents Act, 1970",
				"severity": "HIGH",
				"issue": "Traditional Knowledge Bar: Combining known herbs without experimental proof of synergy is considered an unpatentable aggregation of traditional knowledge.",
			})
			recommendations.append(
				"Perform comparative in-vitro / in-vivo trials demonstrating that the combined formulation produces a synergistic effect (Combination Index < 1.0) beyond the individual known effects of each herb."
			)
		elif has_synergistic_efficacy_data:
			recommendations.append(
				"Include clear synergistic efficacy tables and comparative statistical data in Complete Specification (Form 2) to overcome Section 3(p) and Section 3(e) examination objections."
			)

	# 2. Section 3(e) - Mere Admixture Bar
	if is_combination_of_known_herbs_or_drugs and not has_synergistic_efficacy_data:
		if not any(h["section"].startswith("Section 3(p)") for h in hurdles):
			score -= 30
			hurdles.append({
				"section": "Section 3(e) of The Patents Act, 1970",
				"severity": "HIGH",
				"issue": "Mere Admixture: A substance obtained by a mere admixture resulting only in the aggregation of the properties of the components is not patentable.",
			})
			recommendations.append(
				"Provide quantitative proof that the ingredients exhibit an unexpected synergistic interaction."
			)

	# 3. Section 6 of Biological Diversity Act, 2002 - NBA Clearance
	if uses_indian_biological_resources:
		clearances_required.append("Form 1 National Biodiversity Authority (NBA) Prior Approval under Section 6 of BDA 2002")
		recommendations.append(
			"Submit an application to the National Biodiversity Authority (NBA), Chennai, before the grant of the patent (Section 6, Biological Diversity Act, 2002)."
		)

	# 4. Section 3(i) - Method of Treatment Bar
	if is_method_of_treatment:
		score -= 35
		hurdles.append({
			"section": "Section 3(i) of The Patents Act, 1970",
			"severity": "CRITICAL",
			"issue": "Method of Treatment: Any process for the medicinal, surgical, curative, prophylactic, diagnostic, or therapeutic treatment of human beings or animals is non-patentable in India.",
		})
		recommendations.append(
			"Redraft claims strictly as a 'Pharmaceutical / Herbal Composition / Formulation' or 'Process for preparing the composition' rather than a 'Method of treating a disease'."
		)

	# 5. Prior Public Disclosure / Novelty Bar
	if publicly_disclosed_before_filing:
		score -= 50
		hurdles.append({
			"section": "Novelty & Prior Art Bar (Sections 13 & 29-34)",
			"severity": "CRITICAL",
			"issue": "Loss of Novelty: Disclosing the invention in public journals, presentations, YouTube, or commercial sales before filing a patent application destroys novelty.",
		})
		recommendations.append(
			"Verify if the disclosure falls under exceptions in Sections 29-34 (e.g. government-approved exhibition with notice, or filing within 12 months grace period)."
		)

	score = max(5, min(100, score))

	if score >= 80:
		risk_level = "Low Risk (Strong Patentability Profile)"
		summary_text = "The invention satisfies core patentability criteria. Ensure claims are formatted cleanly as compositions or novel processes."
	elif score >= 50:
		risk_level = "Moderate Risk (Action Required)"
		summary_text = "The invention has strong potential but must overcome specific statutory requirements (e.g., synergistic data, claim re-formatting, or NBA clearance)."
	else:
		risk_level = "High Risk / Statutory Bar"
		summary_text = "Significant statutory blockers detected under Indian Patent Law. Follow the recommendations below to restructure the patent specification."

	return {
		"title": title,
		"patentability_score": score,
		"risk_level": risk_level,
		"summary": summary_text,
		"statutory_hurdles": hurdles,
		"required_clearances": clearances_required,
		"strategic_recommendations": recommendations,
	}
