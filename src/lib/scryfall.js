/**
 * Utility for rate-limited Scryfall API calls.
 * Scryfall allows ~10 req/s. We use 150ms between calls to be safe.
 */

const SCRYFALL_DELAY = 150 // ms between requests

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Fetch with automatic retry on 429 (rate limit).
 * Waits exponentially before retrying.
 */
export async function scryfallFetch(url, options = {}, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options)
      if (res.status === 429) {
        const wait = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
        console.warn(`Scryfall 429 - waiting ${wait}ms before retry ${attempt + 1}`)
        await sleep(wait)
        continue
      }
      return res
    } catch (err) {
      if (attempt === retries) throw err
      await sleep(Math.pow(2, attempt) * 500)
    }
  }
  throw new Error('Scryfall rate limit exceeded after retries')
}

/**
 * Fetch cards in batches of 75 from /cards/collection with proper rate limiting.
 * @param {string[]} ids - Array of Scryfall card IDs
 * @returns {Promise<Object[]>} - Array of card objects
 */
export async function fetchCardsByIds(ids) {
  const uniqueIds = [...new Set(ids)]
  const results = []

  for (let i = 0; i < uniqueIds.length; i += 75) {
    const chunk = uniqueIds.slice(i, i + 75)
    try {
      const res = await scryfallFetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: chunk.map((id) => ({ id })) }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.data) results.push(...data.data)
      }
    } catch (err) {
      console.error('Scryfall collection error', err)
    }
    // Respect rate limit between chunks
    if (i + 75 < uniqueIds.length) await sleep(SCRYFALL_DELAY)
  }

  return results
}
