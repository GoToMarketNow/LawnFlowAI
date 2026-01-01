import { parsePhoneNumberFromString, CountryCode } from "libphonenumber-js";

export function normalizePhoneToE164(
  phone: string,
  defaultCountry: CountryCode = "US"
): string | null {
  try {
    const parsed = parsePhoneNumberFromString(phone, defaultCountry);
    if (parsed && parsed.isValid()) {
      return parsed.format("E.164");
    }
    return null;
  } catch (error) {
    console.error("Phone parsing error:", error);
    return null;
  }
}

export function isValidPhone(
  phone: string,
  defaultCountry: CountryCode = "US"
): boolean {
  try {
    const parsed = parsePhoneNumberFromString(phone, defaultCountry);
    return parsed !== undefined && parsed.isValid();
  } catch {
    return false;
  }
}

export function formatPhoneForDisplay(phoneE164: string): string {
  try {
    const parsed = parsePhoneNumberFromString(phoneE164);
    if (parsed) {
      return parsed.formatNational();
    }
    return phoneE164;
  } catch {
    return phoneE164;
  }
}
