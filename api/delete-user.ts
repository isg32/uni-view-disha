import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })

  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) return res.status(500).json({ error: 'CLERK_SECRET_KEY not set' })

  const { userId } = req.body as { userId: string }
  if (!userId) return res.status(400).json({ error: 'userId is required' })

  try {
    const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${secretKey}` },
    })

    if (!clerkRes.ok) {
      const data = await clerkRes.json()
      const msg = data?.errors?.[0]?.long_message ?? JSON.stringify(data)
      return res.status(clerkRes.status).json({ error: msg })
    }

    return res.status(200).json({ success: true, deleted: userId })
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}
