import { deepSanitize } from './privacyFilter';

/**
 * Custom Redacting Logger
 * Intercepts all logs and runs deepSanitize before outputting to ensure no PII leakage in console or file outputs.
 */

// Extra safety mask helper for credentials and tokens that might appear in system logs
export function maskSecrets(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(maskSecrets);
  }

  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') || 
        lowerKey.includes('pass') || 
        lowerKey.includes('token') || 
        lowerKey.includes('apikey') || 
        lowerKey.includes('secret')
      ) {
        cleaned[key] = "[REDACTED SECRET]";
      } else {
        cleaned[key] = maskSecrets(obj[key]);
      }
    }
    return cleaned;
  }

  return obj;
}

// Redacts arguments dynamically, supporting contextual secret detection (e.g. key/password labels followed by raw values)
export function redactArgs(args: any[]): any[] {
  let redactNextString = false;
  return args.map((arg) => {
    if (arg === null || arg === undefined) return arg;

    if (typeof arg === 'string') {
      if (redactNextString) {
        if (!arg.includes(' ') && arg.length > 4) {
          redactNextString = false;
          return "[REDACTED SECRET]";
        }
      }
      const lower = arg.toLowerCase();
      if (
        lower.includes('password') || 
        lower.includes('pass:') || 
        lower.includes('pass ') || 
        lower.includes('secret') || 
        lower.includes('credential') || 
        lower.includes('key:')
      ) {
        redactNextString = true;
      }
      return deepSanitize(arg);
    }

    if (typeof arg === 'object') {
      return maskSecrets(deepSanitize(arg));
    }

    return arg;
  });
}

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
const originalDebug = console.debug;

export const logger = {
  info: (message: any, ...args: any[]) => {
    const redacted = redactArgs([message, ...args]);
    originalLog(redacted[0], ...redacted.slice(1));
  },

  warn: (message: any, ...args: any[]) => {
    const redacted = redactArgs([message, ...args]);
    originalWarn(redacted[0], ...redacted.slice(1));
  },

  error: (message: any, ...args: any[]) => {
    const redacted = redactArgs([message, ...args]);
    originalError(redacted[0], ...redacted.slice(1));
  },

  debug: (message: any, ...args: any[]) => {
    const redacted = redactArgs([message, ...args]);
    originalDebug(redacted[0], ...redacted.slice(1));
  }
};

// Hook console globally so that any direct console.log / console.error calls are also automatically sanitized
export function hookGlobalConsole() {
  console.log = (message: any, ...args: any[]) => {
    const redacted = redactArgs([message, ...args]);
    originalLog(redacted[0], ...redacted.slice(1));
  };
  console.warn = (message: any, ...args: any[]) => {
    const redacted = redactArgs([message, ...args]);
    originalWarn(redacted[0], ...redacted.slice(1));
  };
  console.error = (message: any, ...args: any[]) => {
    const redacted = redactArgs([message, ...args]);
    originalError(redacted[0], ...redacted.slice(1));
  };
  console.debug = (message: any, ...args: any[]) => {
    const redacted = redactArgs([message, ...args]);
    originalDebug(redacted[0], ...redacted.slice(1));
  };
}
