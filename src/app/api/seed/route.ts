import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET(req: Request) {
  try {
    const secret = process.env.ADMIN_MAINTENANCE_SECRET?.trim()
    if (!secret) {
      return NextResponse.json({ success: false, error: 'Maintenance endpoint disabled.' }, { status: 503 })
    }

    const requestSecret = req.headers.get('x-admin-secret')?.trim()
    if (!requestSecret || requestSecret !== secret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const adminPassword = await bcrypt.hash('admin123', 10)
    const memberPassword = await bcrypt.hash('member123', 10)
    
    await prisma.user.upsert({
      where: { email: 'admin@coop.com' },
      update: {},
      create: {
        email: 'admin@coop.com',
        name: 'Administrator',
        password: adminPassword,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    })
    
    await prisma.user.upsert({
      where: { email: 'member@example.com' },
      update: {
        name: 'Sample Member',
        staffId: 'OPS-1042',
        password: memberPassword,
        role: 'MEMBER',
        status: 'ACTIVE',
        phone: '+2348012345678',
        department: 'Operations',
        monthlyContribution: 10000,
        specialContribution: 0,
        balance: 120000,
        specialBalance: 0,
        totalContributions: 120000,
        loanBalance: 0,
        voucherEnabled: true,
      },
      create: {
        email: 'member@example.com',
        name: 'Sample Member',
        staffId: 'OPS-1042',
        password: memberPassword,
        role: 'MEMBER',
        status: 'ACTIVE',
        phone: '+2348012345678',
        department: 'Operations',
        monthlyContribution: 10000,
        specialContribution: 0,
        balance: 120000,
        specialBalance: 0,
        totalContributions: 120000,
        loanBalance: 0,
        voucherEnabled: true,
      },
    })
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database seeded successfully',
      users: ['admin@coop.com', 'member@example.com']
    })
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
