"""Generate official Legal Consultation Advisory Reports in PDF format for IP-SAKTI."""

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


def sanitize_text(text: str) -> str:
	"""Replace non-standard unicode characters with ASCII equivalents for ReportLab."""
	if not text:
		return ""
	replacements = {
		"\u2010": "-",
		"\u2011": "-",
		"\u2012": "-",
		"\u2013": "-",
		"\u2014": "-",
		"\u2212": "-",
		"\u2018": "'",
		"\u2019": "'",
		"\u201c": '"',
		"\u201d": '"',
		"\u2022": "*",
		"\u00a0": " ",
		"\u2026": "...",
		"■": "-",
	}
	for old, new in replacements.items():
		text = text.replace(old, new)
	return text


def format_inline_markdown(text: str) -> str:
	"""Safely convert markdown inline tags (bold, italic, code) into ReportLab XML."""
	text = sanitize_text(text)
	# XML entities escaping
	text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
	# Bold **text**
	text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
	# Italic *text* or _text_
	text = re.sub(r"\*([^\*]+?)\*", r"<i>\1</i>", text)
	text = re.sub(r"_([^_]+?)_", r"<i>\1</i>", text)
	# Code `text`
	text = re.sub(r"`([^`]+?)`", r"<font color='#285943'><b>\1</b></font>", text)
	return text


def parse_markdown_to_flowables(text: str, custom_styles: dict[str, ParagraphStyle]) -> list[Any]:
	"""Parse full markdown text into rich ReportLab Flowables (Headings, Tables, Lists, Paragraphs)."""
	flowables: list[Any] = []
	lines = text.split("\n")
	i = 0

	while i < len(lines):
		line = lines[i].strip()

		if not line:
			i += 1
			continue

		# 1. Horizontal Rules
		if line.startswith("---") or line.startswith("***") or line.startswith("___"):
			flowables.append(Spacer(1, 4))
			flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E5DCBF"), spaceAfter=6))
			i += 1
			continue

		# 2. Markdown Headings
		if line.startswith("### "):
			h_text = format_inline_markdown(line[4:])
			flowables.append(Spacer(1, 4))
			flowables.append(Paragraph(h_text, custom_styles["h3_style"]))
			flowables.append(Spacer(1, 2))
			i += 1
			continue
		elif line.startswith("## "):
			h_text = format_inline_markdown(line[3:])
			flowables.append(Spacer(1, 6))
			flowables.append(Paragraph(h_text, custom_styles["h2_style"]))
			flowables.append(Spacer(1, 3))
			i += 1
			continue
		elif line.startswith("# "):
			h_text = format_inline_markdown(line[2:])
			flowables.append(Spacer(1, 8))
			flowables.append(Paragraph(h_text, custom_styles["h1_style"]))
			flowables.append(Spacer(1, 4))
			i += 1
			continue

		# 3. Markdown Tables (| col1 | col2 |)
		if line.startswith("|") and line.endswith("|"):
			table_lines = []
			while i < len(lines) and lines[i].strip().startswith("|") and lines[i].strip().endswith("|"):
				table_lines.append(lines[i].strip())
				i += 1

			if len(table_lines) >= 2:
				parsed_rows: list[list[Paragraph]] = []
				for row_idx, tline in enumerate(table_lines):
					# Skip markdown separator line (|---|---|)
					if re.match(r"^\|[\s\-:|]+\|$", tline):
						continue
					raw_cols = [c.strip() for c in tline.split("|")[1:-1]]
					if not raw_cols:
						continue

					row_cells = []
					for c_text in raw_cols:
						fmt_c = format_inline_markdown(c_text)
						if row_idx == 0:
							row_cells.append(Paragraph(f"<b>{fmt_c}</b>", custom_styles["th_style"]))
						else:
							row_cells.append(Paragraph(fmt_c, custom_styles["td_style"]))
					parsed_rows.append(row_cells)

				if parsed_rows:
					num_cols = max(len(r) for r in parsed_rows)
					# Total printable width is 532 pt (612 - 40 - 40)
					if num_cols == 2:
						col_widths = [160, 372]
					elif num_cols == 3:
						col_widths = [140, 150, 242]
					elif num_cols == 4:
						col_widths = [110, 130, 140, 152]
					else:
						col_widths = [532 / num_cols] * num_cols

					table_obj = Table(parsed_rows, colWidths=col_widths)
					table_obj.setStyle(TableStyle([
						("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#285943")),
						("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
						("ALIGN", (0, 0), (-1, -1), "LEFT"),
						("VALIGN", (0, 0), (-1, -1), "TOP"),
						("BOTTOMPADDING", (0, 0), (-1, -1), 4),
						("TOPPADDING", (0, 0), (-1, -1), 4),
						("LEFTPADDING", (0, 0), (-1, -1), 5),
						("RIGHTPADDING", (0, 0), (-1, -1), 5),
						("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5DCBF")),
						("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#FFFEFA"), colors.HexColor("#FAF6ED")]),
					]))
					flowables.append(Spacer(1, 4))
					flowables.append(table_obj)
					flowables.append(Spacer(1, 6))
			continue

		# 4. Bullet lists (- item or 1. item)
		if line.startswith("- ") or line.startswith("* ") or re.match(r"^\d+\.\s", line):
			while i < len(lines) and (
				lines[i].strip().startswith("- ")
				or lines[i].strip().startswith("* ")
				or re.match(r"^\d+\.\s", lines[i].strip())
			):
				l_item = lines[i].strip()
				if l_item.startswith("- ") or l_item.startswith("* "):
					bullet_text = format_inline_markdown(l_item[2:])
					flowables.append(Paragraph(f"• {bullet_text}", custom_styles["bullet_style"]))
				else:
					match = re.match(r"^(\d+\.)\s+(.+)$", l_item)
					if match:
						num_prefix = match.group(1)
						item_text = format_inline_markdown(match.group(2))
						flowables.append(Paragraph(f"<b>{num_prefix}</b> {item_text}", custom_styles["bullet_style"]))
					else:
						flowables.append(Paragraph(format_inline_markdown(l_item), custom_styles["body_style"]))
				i += 1
			flowables.append(Spacer(1, 4))
			continue

		# 5. Regular text paragraphs
		para_lines = []
		while (
			i < len(lines)
			and lines[i].strip()
			and not lines[i].strip().startswith("#")
			and not (lines[i].strip().startswith("|") and lines[i].strip().endswith("|"))
			and not lines[i].strip().startswith("- ")
			and not lines[i].strip().startswith("* ")
			and not lines[i].strip().startswith("---")
			and not re.match(r"^\d+\.\s", lines[i].strip())
		):
			para_lines.append(lines[i].strip())
			i += 1

		if para_lines:
			combined = " ".join(para_lines)
			fmt_p = format_inline_markdown(combined)
			flowables.append(Paragraph(fmt_p, custom_styles["body_style"]))
			flowables.append(Spacer(1, 4))

	return flowables


def generate_consultation_pdf(
	session_id: str,
	history: list[dict[str, Any]],
	user_email: str | None = None,
	user_name: str | None = None,
) -> io.BytesIO:
	"""Generate a PDF consultation report with IP-SAKTI brand colors and full table/bold support."""
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

	# IP-SAKTI Brand Palette Colors
	herbal_green = colors.HexColor("#285943")
	earth_brown = colors.HexColor("#7A5135")
	muted_gold = colors.HexColor("#C59A3D")
	ivory_border = colors.HexColor("#E5DCBF")
	ivory_bg = colors.HexColor("#FAF6ED")

	title_style = ParagraphStyle(
		"DocTitle",
		parent=styles["Heading1"],
		fontName="Helvetica-Bold",
		fontSize=20,
		leading=24,
		textColor=herbal_green,
		alignment=1,  # Centered
	)

	subtitle_style = ParagraphStyle(
		"DocSubtitle",
		parent=styles["Normal"],
		fontName="Helvetica-Bold",
		fontSize=10.5,
		leading=14,
		textColor=earth_brown,
		alignment=1,
	)

	meta_label = ParagraphStyle(
		"MetaLabel",
		parent=styles["Normal"],
		fontName="Helvetica-Bold",
		fontSize=8.5,
		leading=11,
		textColor=earth_brown,
	)

	meta_val = ParagraphStyle(
		"MetaVal",
		parent=styles["Normal"],
		fontName="Helvetica",
		fontSize=8.5,
		leading=11,
		textColor=colors.HexColor("#182C22"),
	)

	q_style = ParagraphStyle(
		"QuestionStyle",
		parent=styles["Heading3"],
		fontName="Helvetica-Bold",
		fontSize=11,
		leading=15,
		textColor=herbal_green,
	)

	body_style = ParagraphStyle(
		"BodyStyle",
		parent=styles["Normal"],
		fontName="Helvetica",
		fontSize=9.5,
		leading=13.5,
		textColor=colors.HexColor("#182C22"),
	)

	h1_style = ParagraphStyle(
		"H1Style",
		parent=styles["Heading1"],
		fontName="Helvetica-Bold",
		fontSize=13,
		leading=17,
		textColor=herbal_green,
	)

	h2_style = ParagraphStyle(
		"H2Style",
		parent=styles["Heading2"],
		fontName="Helvetica-Bold",
		fontSize=11,
		leading=15,
		textColor=herbal_green,
	)

	h3_style = ParagraphStyle(
		"H3Style",
		parent=styles["Heading3"],
		fontName="Helvetica-Bold",
		fontSize=10,
		leading=13,
		textColor=earth_brown,
	)

	th_style = ParagraphStyle(
		"THStyle",
		parent=styles["Normal"],
		fontName="Helvetica-Bold",
		fontSize=8.5,
		leading=11,
		textColor=colors.white,
	)

	td_style = ParagraphStyle(
		"TDStyle",
		parent=styles["Normal"],
		fontName="Helvetica",
		fontSize=8,
		leading=11,
		textColor=colors.HexColor("#182C22"),
	)

	bullet_style = ParagraphStyle(
		"BulletStyle",
		parent=styles["Normal"],
		fontName="Helvetica",
		fontSize=9,
		leading=13,
		leftIndent=12,
		textColor=colors.HexColor("#182C22"),
	)

	citation_style = ParagraphStyle(
		"CitationStyle",
		parent=styles["Normal"],
		fontName="Helvetica",
		fontSize=8,
		leading=11,
		textColor=colors.HexColor("#285943"),
	)

	disclaimer_style = ParagraphStyle(
		"DisclaimerStyle",
		parent=styles["Normal"],
		fontName="Helvetica-Oblique",
		fontSize=7.5,
		leading=10,
		textColor=colors.HexColor("#7A5135"),
		alignment=1,
	)

	custom_styles = {
		"body_style": body_style,
		"h1_style": h1_style,
		"h2_style": h2_style,
		"h3_style": h3_style,
		"th_style": th_style,
		"td_style": td_style,
		"bullet_style": bullet_style,
	}

	story = []

	# 1. Header
	story.append(Paragraph("IP-SAKTI 🌿", title_style))
	story.append(Paragraph("Intellectual Property Law & Traditional Knowledge Advisory Report", subtitle_style))
	story.append(Spacer(1, 10))
	story.append(HRFlowable(width="100%", thickness=1.5, color=herbal_green, spaceAfter=10))

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
		("BACKGROUND", (0, 0), (-1, -1), ivory_bg),
		("BOX", (0, 0), (-1, -1), 0.5, ivory_border),
		("INNERGRID", (0, 0), (-1, -1), 0.25, ivory_border),
		("TOPPADDING", (0, 0), (-1, -1), 4),
		("BOTTOMPADDING", (0, 0), (-1, -1), 4),
	]))
	story.append(meta_table)
	story.append(Spacer(1, 14))

	# 3. Consultation Q&A Transcript
	story.append(Paragraph("<b>LEGAL CONSULTATION INQUIRIES & ADVISORY TRANSCRIPT</b>", q_style))
	story.append(Spacer(1, 6))

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

			user_clean = format_inline_markdown(user_text)

			turn_block: list[Any] = [
				Paragraph(f"<b>Query #{turn_index}:</b> {user_clean}", q_style),
				Spacer(1, 4),
			]

			# Parse full markdown into tables, headings, and paragraphs
			assistant_flowables = parse_markdown_to_flowables(assistant_text, custom_styles)
			turn_block.extend(assistant_flowables)

			if citations:
				c_lines = []
				for c in citations:
					conf_txt = f" [{c.get('confidence')}]" if c.get("confidence") else ""
					c_lines.append(f"• <b>{c.get('source')}</b> (Page {c.get('page')}){conf_txt}")
				turn_block.append(Spacer(1, 4))
				turn_block.append(Paragraph("<b>Official Statutory Citations:</b><br/>" + "<br/>".join(c_lines), citation_style))

			turn_block.append(Spacer(1, 8))
			turn_block.append(HRFlowable(width="100%", thickness=0.5, color=ivory_border, spaceAfter=8))
			story.append(KeepTogether(turn_block))
			turn_index += 1
		i += 1

	if turn_index == 1:
		story.append(Paragraph("<i>No consultation messages recorded in this session.</i>", body_style))
		story.append(Spacer(1, 14))

	# 4. Disclaimer & Authentication Block
	story.append(Spacer(1, 10))
	disclaimer_text = (
		"<b>STATUTORY LEGAL DISCLAIMER:</b> This report is generated by IP-SAKTI for preliminary informational "
		"and guidance purposes only. It is based on official Indian statutes (The Patents Act 1970, The Trade Marks Act 1999, "
		"The Biological Diversity Act 2002) and published TKDL guidelines. It does not constitute formal legal counsel, "
		"an attorney-client relationship, or a guaranteed patent grant from the Controller General of Patents, Designs and Trade Marks (CGPDTM)."
	)
	story.append(HRFlowable(width="100%", thickness=1, color=earth_brown, spaceAfter=6))
	story.append(Paragraph(disclaimer_text, disclaimer_style))

	doc.build(story)
	buffer.seek(0)
	return buffer
