"""Generate official Legal Consultation Advisory Reports in PDF format."""

from __future__ import annotations

import io
import re
import datetime
from typing import Any
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
	SimpleDocTemplate,
	Paragraph,
	Spacer,
	Table,
	TableStyle,
	HRFlowable,
	KeepTogether,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


def _format_markdown_for_reportlab(text: str) -> str:
	"""Safely convert markdown to valid ReportLab XML (<b>, <i>, <br/>) and escape entities."""
	if not text:
		return ""
	# Escape ampersands
	text = text.replace("&", "&amp;")
	# Escape raw angle brackets
	text = text.replace("<", "&lt;").replace(">", "&gt;")
	# Convert newlines to linebreaks
	text = text.replace("\n", "<br/>")
	# Convert **bold** to <b>bold</b>
	text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
	# Convert *italic* to <i>italic</i>
	text = re.sub(r"\*([^\*]+?)\*", r"<i>\1</i>", text)
	# Convert `code` to <i>code</i>
	text = re.sub(r"`([^`]+?)`", r"<font color='#0f766e'>\1</font>", text)
	return text


def generate_consultation_pdf(
	session_id: str,
	history: list[dict[str, Any]],
	user_email: str | None = None,
	user_name: str | None = None,
) -> io.BytesIO:
	"""Generate a PDF consultation report from a conversation history."""
	buffer = io.BytesIO()
	doc = SimpleDocTemplate(
		buffer,
		pagesize=letter,
		rightMargin=40,
		leftMargin=40,
		topMargin=40,
		bottomMargin=40,
	)

	styles = getSampleStyleSheet()

	# Custom Styles
	primary_color = colors.HexColor("#1e3a8a")  # Deep Navy legal tone
	secondary_color = colors.HexColor("#475569")
	accent_color = colors.HexColor("#b45309")

	title_style = ParagraphStyle(
		"DocTitle",
		parent=styles["Heading1"],
		fontName="Helvetica-Bold",
		fontSize=20,
		leading=24,
		textColor=primary_color,
		alignment=1,  # Centered
	)

	subtitle_style = ParagraphStyle(
		"DocSubtitle",
		parent=styles["Normal"],
		fontName="Helvetica-Bold",
		fontSize=11,
		leading=15,
		textColor=accent_color,
		alignment=1,
	)

	meta_label = ParagraphStyle(
		"MetaLabel",
		parent=styles["Normal"],
		fontName="Helvetica-Bold",
		fontSize=9,
		leading=12,
		textColor=colors.black,
	)

	meta_val = ParagraphStyle(
		"MetaVal",
		parent=styles["Normal"],
		fontName="Helvetica",
		fontSize=9,
		leading=12,
		textColor=colors.HexColor("#334155"),
	)

	q_style = ParagraphStyle(
		"QuestionStyle",
		parent=styles["Heading3"],
		fontName="Helvetica-Bold",
		fontSize=11,
		leading=15,
		textColor=primary_color,
	)

	a_style = ParagraphStyle(
		"AnswerStyle",
		parent=styles["Normal"],
		fontName="Helvetica",
		fontSize=10,
		leading=14,
		textColor=colors.HexColor("#1e293b"),
	)

	citation_style = ParagraphStyle(
		"CitationStyle",
		parent=styles["Normal"],
		fontName="Helvetica-Oblique",
		fontSize=8.5,
		leading=12,
		textColor=colors.HexColor("#047857"),  # Emerald green citation
	)

	disclaimer_style = ParagraphStyle(
		"DisclaimerStyle",
		parent=styles["Normal"],
		fontName="Helvetica-Oblique",
		fontSize=7.5,
		leading=10,
		textColor=colors.HexColor("#64748b"),
		alignment=1,
	)

	story = []

	# 1. Header
	story.append(Paragraph("IP SHAKTI SAHAYAK 🇮🇳", title_style))
	story.append(Paragraph("Intellectual Property Law & Traditional Knowledge Advisory Report", subtitle_style))
	story.append(Spacer(1, 12))
	story.append(HRFlowable(width="100%", thickness=1.5, color=primary_color, spaceAfter=12))

	# 2. Metadata Table
	report_date = datetime.datetime.now().strftime("%d %B %Y, %I:%M %p IST")
	client_name = user_name or user_email or "Guest Researcher"

	meta_data = [
		[
			Paragraph("<b>Consultation Reference:</b>", meta_label),
			Paragraph(session_id, meta_val),
			Paragraph("<b>Generated On:</b>", meta_label),
			Paragraph(report_date, meta_val),
		],
		[
			Paragraph("<b>Applicant / Client:</b>", meta_label),
			Paragraph(client_name, meta_val),
			Paragraph("<b>Jurisdiction:</b>", meta_label),
			Paragraph("India (IPO / TKDL / NBA)", meta_val),
		],
		[
			Paragraph("<b>Statutory Framework:</b>", meta_label),
			Paragraph("Patents Act 1970, Trade Marks Act 1999, BDA 2002", meta_val),
			Paragraph("<b>Status:</b>", meta_label),
			Paragraph("Certified Informational Record", meta_val),
		],
	]

	meta_table = Table(meta_data, colWidths=[120, 150, 110, 150])
	meta_table.setStyle(TableStyle([
		("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
		("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
		("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
		("TOPPADDING", (0, 0), (-1, -1), 5),
		("BOTTOMPADDING", (0, 0), (-1, -1), 5),
	]))
	story.append(meta_table)
	story.append(Spacer(1, 16))

	# 3. Consultation Q&A Transcript
	story.append(Paragraph("<b>LEGAL CONSULTATION INQUIRIES & ADVISORY TRANSCRIPT</b>", q_style))
	story.append(Spacer(1, 8))

	turn_index = 1
	i = 0
	while i < len(history):
		msg = history[i]
		if msg.get("role") == "user":
			user_text = msg.get("content", "")
			assistant_text = ""
			citations = msg.get("citations")
			confidence = msg.get("confidence")

			if i + 1 < len(history) and history[i + 1].get("role") == "assistant":
				assistant_msg = history[i + 1]
				assistant_text = assistant_msg.get("content", "")
				citations = assistant_msg.get("citations") or citations
				confidence = assistant_msg.get("confidence") or confidence
				i += 1

			user_clean = _format_markdown_for_reportlab(user_text)
			asst_clean = _format_markdown_for_reportlab(assistant_text)

			turn_block = [
				Paragraph(f"<b>Query #{turn_index}:</b> {user_clean}", q_style),
				Spacer(1, 4),
				Paragraph(asst_clean, a_style),
			]

			if citations:
				c_lines = []
				for c in citations:
					conf_txt = f" (Confidence: {c.get('confidence')})" if c.get("confidence") else ""
					c_lines.append(f"• {c.get('source')} [Page {c.get('page')}]{conf_txt}")
				turn_block.append(Spacer(1, 4))
				turn_block.append(Paragraph("<b>Official Statutory Citations:</b><br/>" + "<br/>".join(c_lines), citation_style))

			turn_block.append(Spacer(1, 10))
			turn_block.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"), spaceAfter=10))
			story.append(KeepTogether(turn_block))
			turn_index += 1
		i += 1

	if turn_index == 1:
		story.append(Paragraph("<i>No consultation messages recorded in this session.</i>", a_style))
		story.append(Spacer(1, 14))

	# 4. Disclaimer & Authentication Block
	story.append(Spacer(1, 14))
	disclaimer_text = (
		"<b>STATUTORY LEGAL DISCLAIMER:</b> This report is generated by IP Shakti Sahayak for preliminary informational "
		"and guidance purposes only. It is based on official Indian statutes (The Patents Act 1970, The Trade Marks Act 1999, "
		"The Biological Diversity Act 2002) and published TKDL guidelines. It does not constitute formal legal counsel, "
		"an attorney-client relationship, or a guaranteed patent grant from the Controller General of Patents, Designs and Trade Marks (CGPDTM)."
	)
	story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#94a3b8"), spaceAfter=8))
	story.append(Paragraph(disclaimer_text, disclaimer_style))

	doc.build(story)
	buffer.seek(0)
	return buffer
