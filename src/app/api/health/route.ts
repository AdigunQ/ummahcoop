import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DB_TIMEOUT_MS = 1500

async function checkDatabase() {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS)
      ),
    ])

    return { ok: true as const, detail: 'connected' as const }
  } catch {
    return { ok: false as const, detail: 'disconnected' as const }
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const deep = url.searchParams.get('deep') === '1'

  // Lightweight health check for platform routing.
  // We intentionally avoid a DB dependency here so a Postgres hiccup doesn't take the whole app down.
  if (!deep) {
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'skipped',
      release: process.env.RENDER_GIT_COMMIT?.slice(0, 12) || null,
    })
  }

  const db = await checkDatabase()

  return NextResponse.json(
    {
      status: db.ok ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      database: db.detail,
    },
    { status: db.ok ? 200 : 503 }
  )
}
