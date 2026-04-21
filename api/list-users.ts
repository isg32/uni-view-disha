import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow CORS from the same origin
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) return res.status(500).json({ error: 'CLERK_SECRET_KEY not set' })

  try {
    // Fetch up to 200 users from Clerk
    const response = await fetch('https://api.clerk.com/v1/users?limit=200', {
      headers: { Authorization: `Bearer ${secretKey}` },
    })

    if (!response.ok) {
      const err = await response.text()
      return res.status(response.status).json({ error: err })
    }

    const clerkUsers = await response.json()

    const users = clerkUsers.map((u: {
      id: string
      username: string | null
      email_addresses: { email_address: string; id: string }[]
      primary_email_address_id: string
      first_name: string | null
      last_name: string | null
      image_url: string
      public_metadata: Record<string, unknown>
    }) => {
      const primary = u.email_addresses.find(e => e.id === u.primary_email_address_id)
      return {
        id: u.id,
        username: u.username ?? '',
        email: primary?.email_address ?? '',
        firstName: u.first_name,
        lastName: u.last_name,
        imageUrl: u.image_url,
        publicMetadata: u.public_metadata ?? {},
      }
    })

    return res.status(200).json(users)
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}
