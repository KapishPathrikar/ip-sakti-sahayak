"""Safety, guardrails, and input sanitization for the RAG pipeline."""

from __future__ import annotations
import re

# Simple set of prompt injection keywords
INJECTION_KEYWORDS = [
    "ignore previous instructions",
    "ignore all instructions",
    "system override",
    "you are now",
    "acting as",
    "bypass constraints",
    "jailbreak",
    "developer mode",
]

# Core keywords to detect if the query is relevant to Intellectual Property / Indian & International Law
IP_KEYWORDS = [
    "patent",
    "trademark",
    "trade mark",
    "copyright",
    "design",
    "industrial design",
    "wipo",
    "pct",
    "patent cooperation treaty",
    "madrid",
    "trips",
    "paris convention",
    "hague",
    "berne",
    "budapest",
    "world intellectual property",
    "biological diversity",
    "ayush",
    "ayurveda",
    "unani",
    "siddha",
    "sowa rigpa",
    "herbal",
    "drug",
    "cosmetic",
    "formulation",
    "ipr",
    "intellectual property",
    "rule",
    "act",
    "law",
    "section 3",
    "section 3(p)",
    "section 3(e)",
    "section 3(d)",
    "section 3(k)",
    "section 3(i)",
    "section 6",
    "gi tag",
    "geographical indication",
    "prior art",
    "novelty",
    "inventive step",
    "industrial applicability",
    "filing",
    "fee",
    "rebate",
    "subsidy",
    "infringement",
    "licensing",
    "royalty",
    "traditional knowledge",
    "tkdl",
    "nba",
    "national biodiversity authority",
    "sbb",
    "bmc",
    "form 1",
    "form 2",
    "form 3",
    "form 5",
    "form 9",
    "form 18",
    "form 18a",
    "tm-a",
    "tm-m",
    "tm-r",
    "examiner",
    "controller",
    "cgpdtm",
    "ipo",
    "office action",
    "opposition",
    "revocation",
    "compulsory license",
    "specification",
    "claim",
    "priority",
    "provisional",
    "complete",
    "application",
    "inventor",
    "invention",
    "invent",
    "startup",
    "msme",
    "haldi",
    "turmeric",
    "neem",
    "tulsi",
    "dudh",
    "milk",
    "ashwagandha",
    "botanical",
    "traditional",
    "haldidudh",
    "पेटंट",
    "पेटेंट",
    "ट्रेडमार्क",
    "कॉपीराइट",
    "आयुर्वेद",
    "औषध",
    "दवा",
    "हल्दी",
    "नीम",
    "दूध",
    "नियम",
    "कायदा",
    "अधिनियम",
    "अर्ज",
    "नोंदणी",
    "हक्क",
    "अधिकार",
    "शोध",
    "ज्ञान",
]


def is_injection_query(query: str) -> bool:
    """Check solely for prompt injection attempts."""
    clean = query.lower().strip()
    return any(kw in clean for kw in INJECTION_KEYWORDS)


def is_safe_query(query: str) -> tuple[bool, str]:
    """Validate query against prompt injections and off-topic requests."""
    clean_query = query.lower().strip()

    if is_injection_query(clean_query):
        return False, "prompt_injection"

    # Relevance check (off-topic guardrail)
    has_ip_keyword = any(keyword in clean_query for keyword in IP_KEYWORDS)
    if not has_ip_keyword:
        return False, "off_topic"

    return True, "safe"



def get_safety_response(reason: str, lang: str = "en") -> str:
    """Return a localized error response for unsafe inputs."""
    responses = {
        "en": {
            "prompt_injection": "Request rejected due to unsafe content or instruction override attempt.",
            "off_topic": "I am an Indian Intellectual Property assistant. I can only assist with patents, trademarks, copyrights, and related IP law queries.",
        },
        "hi": {
            "prompt_injection": "असुरक्षित सामग्री या निर्देश ओवरराइड प्रयास के कारण अनुरोध अस्वीकार कर दिया गया।",
            "off_topic": "मैं एक भारतीय बौद्धिक संपदा (IP) सहायक हूँ। मैं केवल पेटेंट, ट्रेडमार्क, कॉपीराइट और संबंधित आईपी कानूनों के प्रश्नों में सहायता कर सकता हूँ।",
        },
        "mr": {
            "prompt_injection": "असुरक्षित मजकूर किंवा सूचना ओव्हरराइड करण्याच्या प्रयत्नामुळे विनंती नाकारली गेली आहे.",
            "off_topic": "मी एक भारतीय बौद्धिक संपदा (IP) सहाय्यक आहे. मी फक्त पेटंट, ट्रेडमार्क, कॉपीराइट आणि संबंधित कायदेशीर नियमांच्या प्रश्नांची उत्तरे देऊ शकतो.",
        },
        "hinglish": {
            "prompt_injection": "Request reject kar diya gaya hai kyunki yeh instruction override lag raha hai.",
            "off_topic": "Main ek Indian Intellectual Property (IP) assistant hoon. Main sirf patents, trademarks, copyrights aur IP law se related questions ke answers de sakta hoon.",
        },
        "marathish": {
            "prompt_injection": "Request reject keli ahe karanki he instruction override diste ahe.",
            "off_topic": "Mi ek Indian Intellectual Property (IP) sahayyak ahe. Mi fakt patents, trademarks, copyrights ani kaydeshir niyamanchya prashnanchi uttare deu shakto.",
        },
    }

    lang_code = lang if lang in responses else "en"
    return responses[lang_code].get(reason, responses["en"]["off_topic"])
