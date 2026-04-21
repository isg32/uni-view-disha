import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * GAS Proxy — routes all Google Apps Script requests server-side.
 * GAS Web App POST requests return a 302 redirect before the real response,
 * and ContentService never sends CORS headers — both are solved by proxying.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()

  const gasUrl = process.env.GAS_URL
  if (!gasUrl || gasUrl === 'YOUR_GAS_DEPLOYMENT_URL_HERE') {
    return res.status(503).json({ error: 'GAS_URL is not configured on the server.' })
  }

  try {
    let gasRes: Response

    if (req.method === 'GET') {
      const params = new URLSearchParams(req.query as Record<string, string>)
      gasRes = await fetch(`${gasUrl}?${params.toString()}`, {
        redirect: 'follow',
      })
    } else if (req.method === 'POST') {
      gasRes = await fetch(gasUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      })
    } else {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const text = await gasRes.text()

    // Guard: make sure GAS returned JSON, not an error HTML page
    const trimmed = text.trim()
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      console.error('[gas-proxy] Non-JSON from GAS (first 500 chars):\n', trimmed.slice(0, 500))

      let hint = 'Check that the Web App is deployed as "Execute as: Me | Who has access: Anyone".'
      if (trimmed.includes('Sign in') || trimmed.includes('accounts.google.com')) {
        hint = 'GAS returned a Google login page — set "Who has access" to "Anyone" (not "Anyone with a Google account").'
      } else if (trimmed.includes('Script function not found') || trimmed.includes('ReferenceError')) {
        hint = 'GAS returned a script error. Make sure the latest appscript.gs is saved and redeployed.'
      } else if (trimmed.includes('Authorization') || trimmed.includes('permission')) {
        hint = 'GAS returned an authorization error. Re-authorize the script in the GAS editor.'
      }

      return res.status(502).json({ error: `GAS returned a non-JSON response. ${hint}`, raw: trimmed.slice(0, 400) })
    }

    res.setHeader('Content-Type', 'application/json')
    return res.status(200).send(trimmed)
  } catch (err) {
    console.error('[gas-proxy] Error:', err)
    return res.status(500).json({ error: `Proxy error: ${String(err)}` })
  }
}
