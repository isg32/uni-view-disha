import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) return res.status(500).json({ error: 'CLERK_SECRET_KEY not set' })

  const { userId, role, universitySlug } = req.body as {
    userId: string
    role?: string
    universitySlug?: string
  }

  if (!userId) return res.status(400).json({ error: 'userId is required' })

  // First GET the user's current publicMetadata so we don't clobber other fields
  const getRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  if (!getRes.ok) return res.status(getRes.status).json({ error: await getRes.text() })
  const existing = await getRes.json()
  const currentMeta = existing.public_metadata ?? {}

  // Merge patch — only update provided fields
  const newMeta: Record<string, unknown> = { ...currentMeta }
  if (role !== undefined) newMeta.role = role || null
  if (universitySlug !== undefined) newMeta.universitySlug = universitySlug || null

  // PATCH the user
  const patchRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ public_metadata: newMeta }),
  })

  if (!patchRes.ok) return res.status(patchRes.status).json({ error: await patchRes.text() })

  const updated = await patchRes.json()
  return res.status(200).json({ success: true, publicMetadata: updated.public_metadata })
}
