// The phrase that closes a question thread ("ok that is clear"), with the
// natural variants in English and Polish.
const CLEAR = /^\s*(ok(ay)?[,.]?\s*(that'?s|that is|it'?s|it is)\s*clear|ok[,.]?\s*to\s*(jest\s*)?jasne)\s*[.!]*\s*$/i
export const isClearPhrase = (q: string): boolean => CLEAR.test(q)
