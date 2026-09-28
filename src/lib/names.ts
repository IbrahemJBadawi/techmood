/**
 * A member's full name is written in English (Latin letters), the way it is
 * printed on certificates and read by anyone verifying them. The database
 * holds the same rule (0109); these are the checks the forms run first.
 */
const LETTERS = "A-Za-zÀ-ÖØ-öø-ÿ";

export const ENGLISH_NAME = new RegExp(`^[${LETTERS}][${LETTERS} .'-]{1,119}$`);

/** For an <input pattern>: browsers compile it with the v flag, so "-" is escaped. */
export const ENGLISH_NAME_PATTERN = `[${LETTERS}][${LETTERS} .'\\-]{1,119}`;

/** Collapse runs of spaces; the rest is the person's own spelling. */
export function tidyName(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function isEnglishName(value: string) {
  return ENGLISH_NAME.test(tidyName(value));
}
