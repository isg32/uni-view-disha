import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Creates a Clerk user identified by username + password.
 * Requires the Clerk instance to have "Username" enabled as an identifier:
 *   Clerk Dashboard → User & Authentication → Email, Phone, Username → turn on "Username"
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) return res.status(500).json({ error: 'CLERK_SECRET_KEY not set' })

  const { username, password, firstName, lastName, role, universitySlug } = req.body as {
    username: string
    password: string
    firstName?: string
    lastName?: string
    role?: string
    universitySlug?: string
  }

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' })
  }

  try {
    const body: Record<string, unknown> = { username, password }
    if (firstName) body.first_name = firstName
    if (lastName) body.last_name = lastName

    const publicMetadata: Record<string, unknown> = {}
    if (role) publicMetadata.role = role
    if (universitySlug) publicMetadata.universitySlug = universitySlug
    if (Object.keys(publicMetadata).length > 0) body.public_metadata = publicMetadata

    const clerkRes = await fetch('https://api.clerk.com/v1/users', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await clerkRes.json()
    if (!clerkRes.ok) {
      const msg = data?.errors?.[0]?.long_message ?? data?.errors?.[0]?.message ?? JSON.stringify(data)
      return res.status(clerkRes.status).json({ error: msg })
    }

    return res.status(200).json({
      success: true,
      user: {
        id: data.id,
        username: data.username ?? '',
        email: '',           // username-only users have no email
        firstName: data.first_name ?? null,
        lastName: data.last_name ?? null,
        imageUrl: data.image_url,
        publicMetadata: data.public_metadata ?? {},
      },
    })
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}
