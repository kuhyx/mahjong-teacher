// The phrase that closes a question thread ("ok that is clear"), with the
// natural variants in English and Polish.
const CLEAR = /^\s*(ok(ay)?[,.]?\s*(that'?s|that is|it'?s|it is)\s*clear|ok[,.]?\s*to\s*(jest\s*)?jasne)\s*[.!]*\s*$/i
export const isClearPhrase = (q: string): boolean => CLEAR.test(q)

// Fixed questions sent by a tap, never shown as text: ➤ with an empty box asks
// for a proposal about the marked items, ✗ asks for a different one. Neither
// holds a topic keyword, so they never change an item's topics.
export const PROPOSE_PHRASE = 'show me'
export const REJECT_PHRASE = 'show me another way'
export const isTriggerPhrase = (q: string): boolean => q === PROPOSE_PHRASE || q === REJECT_PHRASE
