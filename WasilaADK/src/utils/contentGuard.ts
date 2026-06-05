/**
 * Content Guardrail Utility for Wasila ADK
 * Filters queries for profanity, explicit topics, off-topic fields, and prompt injections.
 */

// Urdu script cuss words
const URDU_CUSSWORDS = new Set([
  "کتا", "کتے", "کتی", "کتوں", "کمینہ", "کمینے", "چوتیا", "چوتیے", "گانڈو", "خنزیر", "سالا", "سالی", "سالے", "حرامزادہ", "حرام خور", "حرامخور", "رنڈی", "بھڑوا", "بکواس", "کنجر", "لنتی", "لعنت", "لعنتی"
]);

// Roman Urdu cuss words (case-insensitive checking is done via lowercase conversion)
const ROMAN_URDU_CUSSWORDS = new Set([
  // Kutta variations
  "kutta", "kutte", "kutti", "kutty", "kuttay", "kutiya", "kute", "kuti", "kuttey", "kuttay", "kutos", "kutoon",
  // Chutiya variations
  "chutiya", "chutya", "chutiye", "chutyay", "chutia", "chutiyaa", "chutyaa", "chut", "choote",
  // Harami variations
  "harami", "haramzaada", "haramzada", "haramkhore", "haramkhor", "herami", "harme",
  // Kamina variations
  "kamina", "kaminey", "kamine", "kamino", "kameena", "kameenay",
  // Gandu variations
  "gandu", "gand", "gandoo", "ganduo", "gandwa", "bund",
  // Saala variations
  "saala", "sala", "sali", "saali", "salay", "saalay", "sallay",
  // Bhenchod variations
  "bhenchod", "behenchod", "banchod", "bhanchod", "bhen-chod", "behen-chod", "penchod", "pnchod", "bhnchod", "behnchod",
  // Madarchod variations
  "madarchod", "madar-chod", "mamu-chod", "mdrchod",
  // Randi variations
  "randi", "rndi", "rande", "randy", "randia",
  // Kanjar variations
  "kanjar", "kanjri", "knjar",
  // Gashti variations
  "gashti", "gushti", "gashtee",
  // Lanat variations
  "lanti", "laanat", "lanat", "laanati", "lanati", "lantiya",
  // Other abbreviations/slangs
  "bc", "mc", "bsdk", "loda", "lauda", "lode", "penyakiri", "bakwas"
]);

// English/Common cuss words
const ENGLISH_CUSSWORDS = new Set([
  "fuck", "shit", "asshole", "bitch", "bastard", "cunt", "dick", "pussy", "fucker", "fucking"
]);

// Off-topic: Politics keywords
const POLITICS_KEYWORDS = [
  "imran khan", "nawaz sharif", "zardari", "pti", "pmln", "ppp", "fauj", "army", "general", "fauji", "establishment", "siasat", "politics", "election", "pdm", "shahbaz sharif", "bajwa", "imran", "nawaz", "sharif", "bilawal", "mariam nawaz", "maryam nawaz"
];

// Off-topic: Violence keywords
const VIOLENCE_KEYWORDS = [
  "kill", "murder", "marna", "qatl", "khoon", "bomb", "blast", "attack", "dhamaaka", "weapon", "bandook", "pistol", "mardu", "goli"
];

// Off-topic: Explicit keywords
const EXPLICIT_KEYWORDS = [
  "sex", "porn", "naked", "chodo", "lund", "gand", "bhoosd", "bhosd", "boba", "boob", "ass", "pussy", "dick", "muth"
];

// Prompt Injection detection regexes
const INJECTION_PATTERNS = [
  /ignore.*previous.*instruction/i,
  /forget.*system.*prompt/i,
  /bypass.*safety/i,
  /system.*check/i,
  /you.*now.*developer/i,
  /developer.*mode/i,
  /system.*override/i,
  /nayi.*instructions/i,
  /ignore.*rules/i
];

export interface GuardrailResult {
  blocked: boolean;
  reason: 'profanity' | 'off_topic' | 'injection' | null;
  reply: string; // Localized block warning response
}

/**
 * Standardizes a string by stripping punctuation and converting to lowercase
 */
function cleanQuery(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'۔؟]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Analyzes the query against safety guardrails
 */
export function checkContentSafety(query: string): GuardrailResult {
  if (!query || typeof query !== 'string') {
    return { blocked: false, reason: null, reply: "" };
  }

  const cleaned = cleanQuery(query);
  const words = cleaned.split(' ');

  // 1. Check for Prompt Injection
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(query)) {
      const isUrduScript = /[\u0600-\u06FF]/.test(query);
      return {
        blocked: true,
        reason: 'injection',
        reply: isUrduScript 
          ? "سستم سیکیورٹی ایکٹو ہے۔ آپ کا ایکشن بلاک کر دیا گیا ہے۔"
          : "System security active hai. Aap ka action block kar diya gaya hai."
      };
    }
  }

  // 2. Check for Profanity (Nastaliq, Roman Urdu, English)
  for (const word of words) {
    if (ROMAN_URDU_CUSSWORDS.has(word) || URDU_CUSSWORDS.has(word) || ENGLISH_CUSSWORDS.has(word)) {
      const isUrduScript = /[\u0600-\u06FF]/.test(query);
      return {
        blocked: true,
        reason: 'profanity',
        reply: isUrduScript
          ? "براہِ مہربانی، اخلاقیات کا دھیان رکھیں اور غلط الفاظ کا استعمال نہ کریں۔"
          : "Bara-e-meharbani, ikhlaqiat ka dhyan rakhein aur ghalat alfaz ka istemal na karein."
      };
    }
  }

  // 3. Check for Off-topic categories (politics, explicit, violence)
  // Politics
  for (const kw of POLITICS_KEYWORDS) {
    if (cleaned.includes(kw)) {
      const isUrduScript = /[\u0600-\u06FF]/.test(query);
      return {
        blocked: true,
        reason: 'off_topic',
        reply: isUrduScript
          ? "وسیلہ صرف پروفیشنل سروسز (AC Repair, Plumber, etc.) کے لیے ہے۔ میں اس موضوع پر بات نہیں کر سکتا۔"
          : "Wasila sirf professional services (AC Repair, Plumber, etc.) ke liye hai. Main is topic par baat nahi kar sakta."
      };
    }
  }

  // Violence
  for (const kw of VIOLENCE_KEYWORDS) {
    if (cleaned.includes(kw)) {
      const isUrduScript = /[\u0600-\u06FF]/.test(query);
      return {
        blocked: true,
        reason: 'off_topic',
        reply: isUrduScript
          ? "وسیلہ صرف پروفیشنل سروسز کے لیے ہے۔ میں تشدد یا غیر قانونی موضوعات پر بات نہیں کر سکتا۔"
          : "Wasila sirf professional services ke liye hai. Main violence ya illegal topics par baat nahi kar sakta."
      };
    }
  }

  // Explicit
  for (const kw of EXPLICIT_KEYWORDS) {
    if (cleaned.includes(kw)) {
      const isUrduScript = /[\u0600-\u06FF]/.test(query);
      return {
        blocked: true,
        reason: 'off_topic',
        reply: isUrduScript
          ? "وسیلہ صرف پروفیشنل سروسز کے لیے ہے۔ میں فحش یا غیر اخلاقی موضوعات پر بات نہیں کر سکتا۔"
          : "Wasila sirf professional services ke liye hai. Main explicit ya inappropriate topics par baat nahi kar sakta."
      };
    }
  }

  return { blocked: false, reason: null, reply: "" };
}
