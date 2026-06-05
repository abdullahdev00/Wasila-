/**
 * Privacy Filter Utility for PII Redaction
 * Ensures sensitive data is masked before being sent to the LLM.
 */

// CNIC masking: XXXXX-XXXXXXX-X
export const CNIC_MASK = "XXXXX-XXXXXXX-X";
// Phone masking: 03XX-XXXXXXX
export const PHONE_MASK = "03XX-XXXXXXX";
// Email masking: ****@****.***
export const EMAIL_MASK = "****@****.***";
// Address masking: [REDACTED ADDRESS]
export const ADDRESS_MASK = "[REDACTED ADDRESS]";
// Bank Account masking: XXXXXXXXXXXX
export const BANK_MASK = "XXXXXXXXXXXX";

/**
 * Redacts PII from raw string values (e.g. conversational text) using RegExp
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') return text;

  let sanitized = text;

  // 1. Mask CNIC formats (e.g., 12345-1234567-1 or 13-digit continuous)
  sanitized = sanitized.replace(/\b\d{5}-\d{7}-\d\b/g, CNIC_MASK);
  sanitized = sanitized.replace(/\b\d{13}\b/g, CNIC_MASK);

  // 2. Mask Phone formats (Pakistani mobile numbers, continuous 9-12 digits, formatted numbers)
  sanitized = sanitized.replace(/\b\d{9,12}\b/g, PHONE_MASK);
  sanitized = sanitized.replace(/\b(?:\+?92[- ]?|0)?[- ]?3\d{2}[- ]?\d{7}\b/g, PHONE_MASK);

  // 3. Mask Email addresses
  sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, EMAIL_MASK);

  // 4. Mask API keys (e.g., sk-..., AIzaSy...)
  sanitized = sanitized.replace(/\b(?:sk-[a-zA-Z0-9-_]+|AIzaSy[a-zA-Z0-9_-]+)\b/gi, "[REDACTED SECRET]");

  return sanitized;
}

/**
 * Sanitizes specific object keys for LLM input
 */
export function sanitizeForLLM(data: any): any {
  if (!data || typeof data !== 'object') return data;

  const sanitized = { ...data };

  // CNIC Mask
  if (sanitized.cnic !== undefined && sanitized.cnic !== null) {
    sanitized.cnic = CNIC_MASK;
  }

  // Phone Mask
  if (sanitized.phone !== undefined && sanitized.phone !== null) {
    sanitized.phone = PHONE_MASK;
  }

  // Email Mask
  if (sanitized.email !== undefined && sanitized.email !== null) {
    if (typeof sanitized.email === 'string' && sanitized.email.includes('@')) {
      const [user, domain] = sanitized.email.split('@');
      sanitized.email = `${user[0] || '*'}***@${domain}`;
    } else {
      sanitized.email = EMAIL_MASK;
    }
  }

  // Address Mask (preserve area or general city if present, redact exact block/house details)
  if (sanitized.fullAddress !== undefined && sanitized.fullAddress !== null) {
    sanitized.fullAddress = sanitized.area || sanitized.location || ADDRESS_MASK;
  } else if (sanitized.address !== undefined && sanitized.address !== null) {
    sanitized.address = sanitized.area || sanitized.location || ADDRESS_MASK;
  }

  // User ID Mask
  if (sanitized.userId !== undefined && sanitized.userId !== null) {
    if (typeof sanitized.userId === 'string' && sanitized.userId.length > 4) {
      sanitized.userId = `USR_${sanitized.userId.slice(-4)}`;
    }
  }
  if (sanitized.uid !== undefined && sanitized.uid !== null) {
    if (typeof sanitized.uid === 'string' && sanitized.uid.length > 4) {
      sanitized.uid = `USR_${sanitized.uid.slice(-4)}`;
    }
  }

  // Bank Account Mask
  if (sanitized.bankAccount !== undefined && sanitized.bankAccount !== null) {
    sanitized.bankAccount = BANK_MASK;
  }

  return sanitized;
}

/**
 * Recursively sanitizes objects and arrays
 */
export function deepSanitize(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(deepSanitize);
  }

  if (typeof obj === 'object') {
    // 1. Sanitize standard keys on this level first
    const sanitizedLevel = sanitizeForLLM(obj);
    const clean: any = {};

    // 2. Recursively sanitize nested structures
    for (const key of Object.keys(sanitizedLevel)) {
      let val = sanitizedLevel[key];
      if (typeof val === 'string') {
        // Run regex string mask to capture any inline numbers/emails in chat history/notes
        clean[key] = sanitizeText(val);
      } else {
        clean[key] = deepSanitize(val);
      }
    }
    return clean;
  }

  if (typeof obj === 'string') {
    return sanitizeText(obj);
  }

  return obj;
}
