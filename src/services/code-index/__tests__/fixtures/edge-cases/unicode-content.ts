/**
 * Test fixture: Unicode and special characters
 * 
 * Tests:
 * - Emoji in comments and strings
 * - CJK (Chinese, Japanese, Korean) characters
 * - RTL (Right-to-Left) text
 * - Special Unicode characters
 * - Accented characters
 */

// Emoji in comments 🚀 ✨ 🎉 💻 🔥
export const EMOJI_CONSTANTS = {
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  ROCKET: '🚀',
  FIRE: '🔥'
}

// CJK Characters - Chinese
export const CHINESE_GREETINGS = {
  hello: '你好',
  goodbye: '再见',
  thankYou: '谢谢',
  welcome: '欢迎'
}

// CJK Characters - Japanese
export const JAPANESE_GREETINGS = {
  hello: 'こんにちは',
  goodbye: 'さようなら',
  thankYou: 'ありがとう',
  welcome: 'ようこそ'
}

// CJK Characters - Korean
export const KOREAN_GREETINGS = {
  hello: '안녕하세요',
  goodbye: '안녕히 가세요',
  thankYou: '감사합니다',
  welcome: '환영합니다'
}

// RTL (Right-to-Left) - Arabic
export const ARABIC_GREETINGS = {
  hello: 'مرحبا',
  goodbye: 'وداعا',
  thankYou: 'شكرا',
  welcome: 'أهلا وسهلا'
}

// RTL - Hebrew
export const HEBREW_GREETINGS = {
  hello: 'שלום',
  goodbye: 'להתראות',
  thankYou: 'תודה',
  welcome: 'ברוך הבא'
}

// Accented characters - French
export const FRENCH_PHRASES = {
  café: 'café',
  résumé: 'résumé',
  naïve: 'naïve',
  façade: 'façade',
  déjàVu: 'déjà vu'
}

// Accented characters - Spanish
export const SPANISH_PHRASES = {
  niño: 'niño',
  señor: 'señor',
  año: 'año',
  jalapeño: 'jalapeño'
}

// Mathematical symbols
export const MATH_SYMBOLS = {
  infinity: '∞',
  pi: 'π',
  sum: '∑',
  integral: '∫',
  notEqual: '≠',
  lessThanOrEqual: '≤',
  greaterThanOrEqual: '≥',
  plusMinus: '±'
}

// Currency symbols
export const CURRENCY_SYMBOLS = {
  dollar: '$',
  euro: '€',
  pound: '£',
  yen: '¥',
  rupee: '₹',
  bitcoin: '₿'
}

// Special characters
export const SPECIAL_CHARS = {
  copyright: '©',
  registered: '®',
  trademark: '™',
  degree: '°',
  bullet: '•',
  ellipsis: '…'
}

// Function with Unicode parameter names (valid in ES6+)
export function 计算总和(数字1: number, 数字2: number): number {
  return 数字1 + 数字2
}

// Class with Unicode property names
export class 用户 {
  名字: string
  年龄: number

  constructor(名字: string, 年龄: number) {
    this.名字 = 名字
    this.年龄 = 年龄
  }

  问候(): string {
    return `你好，我是${this.名字}，我${this.年龄}岁。`
  }
}

// Mixed Unicode in template literals
export function createGreeting(name: string, language: string): string {
  const greetings: Record<string, string> = {
    en: `Hello ${name}! 👋`,
    zh: `你好 ${name}！👋`,
    ja: `こんにちは ${name}！👋`,
    ko: `안녕하세요 ${name}！👋`,
    ar: `مرحبا ${name}！👋`,
    he: `שלום ${name}！👋`,
    fr: `Bonjour ${name}！👋`,
    es: `Hola ${name}！👋`
  }
  
  return greetings[language] || greetings.en
}

// Emoji in regex patterns
export const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}]/u

// Zero-width characters (invisible but present)
export const ZERO_WIDTH_CHARS = {
  zeroWidthSpace: '\u200B',
  zeroWidthNonJoiner: '\u200C',
  zeroWidthJoiner: '\u200D'
}

// Combining diacritical marks
export const COMBINING_MARKS = {
  acuteAccent: 'e\u0301',  // é
  graveAccent: 'e\u0300',  // è
  circumflex: 'e\u0302',   // ê
  tilde: 'n\u0303'         // ñ
}

