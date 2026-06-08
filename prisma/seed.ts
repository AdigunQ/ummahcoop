import { PrismaClient, PaymentType, TransactionType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function mapPaymentTypeToTransactionType(type: PaymentType): TransactionType {
  if (type === 'LOAN_REPAYMENT') return 'LOAN_REPAYMENT'
  if (type === 'REGISTRATION') return 'REGISTRATION'
  if (type === 'SAVINGS') return 'SAVINGS'
  return 'CONTRIBUTION'
}

async function main() {
  const defaultPassword = await bcrypt.hash('member123', 10)
  const adminPassword = await bcrypt.hash('admin123', 10)
  const now = new Date()

  // Demo-only: make seeded members "old" so vouchers/fees look realistic.
  // New pending members get a recent createdAt so they show up in approvals.
  const oldMemberCreatedAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 10, 9, 0, 0))
  const praiseCreatedAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 10, 9, 0, 0))
  const pendingBaseCreatedAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.min(12, now.getUTCDate()), 9, 0, 0))

  const admin = await prisma.user.upsert({
    where: { email: 'admin@coop.com' },
    update: {
      name: 'Administrator',
      staffId: 'ADM-0001',
      password: adminPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
      department: 'Administration',
      phone: '+2348000000000',
    },
    create: {
      email: 'admin@coop.com',
      name: 'Administrator',
      staffId: 'ADM-0001',
      password: adminPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
      department: 'Administration',
      phone: '+2348000000000',
    },
  })

  const members = [
    {
      email: 'member@example.com',
      staffId: 'OPS-1042',
      name: 'Chinedu Okafor',
      status: 'ACTIVE' as const,
      department: 'Operations',
      phone: '+2348012345678',
      monthlyContribution: 20000,
      specialContribution: 5000,
      balance: 160000,
      specialBalance: 40000,
      totalContributions: 200000,
      loanBalance: 45000,
      bankName: 'Access Bank',
      bankAccountNumber: '0123345678',
      bankAccountName: 'CHINEDU OKAFOR',
      createdAt: oldMemberCreatedAt,
    },
    {
      email: 'aisha.bello@coop.com',
      staffId: 'FIN-2231',
      name: 'Aisha Bello',
      status: 'ACTIVE' as const,
      department: 'Finance',
      phone: '+2348032456711',
      monthlyContribution: 30000,
      specialContribution: 10000,
      balance: 220000,
      specialBalance: 50000,
      totalContributions: 270000,
      loanBalance: 80000,
      bankName: 'GTBank',
      bankAccountNumber: '0211187654',
      bankAccountName: 'AISHA BELLO',
      createdAt: oldMemberCreatedAt,
    },
    {
      email: 'tunde.adeyemi@coop.com',
      staffId: 'ENG-3314',
      name: 'Tunde Adeyemi',
      status: 'ACTIVE' as const,
      department: 'Engineering',
      phone: '+2348021190876',
      monthlyContribution: 25000,
      balance: 180000,
      totalContributions: 180000,
      loanBalance: 0,
      bankName: 'Zenith Bank',
      bankAccountNumber: '0322456711',
      bankAccountName: 'TUNDE ADEYEMI',
      createdAt: oldMemberCreatedAt,
    },
    {
      email: 'admins@coop.com',
      staffId: 'ADM-1190',
      name: 'Praise Eshue',
      status: 'ACTIVE' as const,
      department: 'Administration',
      phone: '+2348134001122',
      monthlyContribution: 10000,
      balance: 98500,
      totalContributions: 128500,
      loanBalance: 0,
      bankName: 'GTBank',
      bankAccountNumber: '0234517890',
      bankAccountName: 'PRAISE ESHUE',
      createdAt: praiseCreatedAt,
    },
    {
      email: 'ngozi.eze@coop.com',
      staffId: 'CS-0982',
      name: 'Ngozi Eze',
      status: 'ACTIVE' as const,
      department: 'Customer Success',
      phone: '+2348099911223',
      monthlyContribution: 15000,
      balance: 90000,
      totalContributions: 90000,
      loanBalance: 0,
      bankName: 'UBA',
      bankAccountNumber: '0456677890',
      bankAccountName: 'NGOZI EZE',
      createdAt: oldMemberCreatedAt,
    },
    {
      email: 'kemi.oshinowo@coop.com',
      staffId: 'PDT-5570',
      name: 'Kemi Oshinowo',
      status: 'ACTIVE' as const,
      department: 'Product',
      phone: '+2348102233445',
      monthlyContribution: 35000,
      balance: 300000,
      totalContributions: 300000,
      loanBalance: 120000,
      bankName: 'Fidelity Bank',
      bankAccountNumber: '0612245500',
      bankAccountName: 'KEMI OSHINOWO',
      createdAt: oldMemberCreatedAt,
    },
    {
      email: 'emeka.nwosu@coop.com',
      staffId: 'LOG-6619',
      name: 'Emeka Nwosu',
      status: 'ACTIVE' as const,
      department: 'Logistics',
      phone: '+2348135566778',
      monthlyContribution: 22000,
      balance: 125000,
      totalContributions: 125000,
      loanBalance: 0,
      bankName: 'Moniepoint',
      bankAccountNumber: '0713300112',
      bankAccountName: 'EMEKA NWOSU',
      createdAt: oldMemberCreatedAt,
    },
    {
      email: 'ibrahim.sani@coop.com',
      staffId: 'RC-4407',
      name: 'Ibrahim Sani',
      status: 'ACTIVE' as const,
      department: 'Risk & Compliance',
      phone: '+2348073344556',
      monthlyContribution: 18000,
      balance: 108000,
      totalContributions: 108000,
      loanBalance: 0,
      bankName: 'First Bank',
      bankAccountNumber: '0523377781',
      bankAccountName: 'IBRAHIM SANI',
      createdAt: oldMemberCreatedAt,
    },
    {
      email: 'olumide.falola@coop.com',
      staffId: 'SAL-8830',
      name: 'Olumide Falola',
      status: 'ACTIVE' as const,
      department: 'Sales',
      phone: '+2348146677889',
      monthlyContribution: 28000,
      balance: 195000,
      totalContributions: 195000,
      loanBalance: 65000,
      bankName: 'Wema Bank',
      bankAccountNumber: '0912233445',
      bankAccountName: 'OLUMIDE FALOLA',
      createdAt: oldMemberCreatedAt,
    },
    {
      email: 'hadiza.yusuf@coop.com',
      staffId: 'LEG-7723',
      name: 'Hadiza Yusuf',
      status: 'ACTIVE' as const,
      department: 'Legal',
      phone: '+2348067788990',
      monthlyContribution: 20000,
      balance: 120000,
      totalContributions: 120000,
      loanBalance: 0,
      bankName: 'Sterling Bank',
      bankAccountNumber: '0811447788',
      bankAccountName: 'HADIZA YUSUF',
      createdAt: oldMemberCreatedAt,
    },

    // Seed exactly 5 fresh pending members so Admin can test the approvals flow.
    {
      email: 'zainab.sule@coop.com',
      staffId: 'FAAN-4001',
      name: 'Zainab Sule',
      status: 'PENDING' as const,
      department: 'Aviation Operations',
      phone: '+2348031102201',
      monthlyContribution: 10000,
      balance: 0,
      totalContributions: 0,
      loanBalance: 0,
      bankName: 'UBA',
      bankAccountNumber: '0447712903',
      bankAccountName: 'ZAINAB SULE',
      createdAt: new Date(pendingBaseCreatedAt.getTime() - 1000 * 60 * 60 * 24 * 2),
    },
    {
      email: 'seyi.adebayo@coop.com',
      staffId: 'FAAN-4002',
      name: 'Seyi Adebayo',
      status: 'PENDING' as const,
      department: 'Security',
      phone: '+2348058807712',
      monthlyContribution: 15000,
      balance: 0,
      totalContributions: 0,
      loanBalance: 0,
      bankName: 'Zenith Bank',
      bankAccountNumber: '0265512347',
      bankAccountName: 'SEYI ADEBAYO',
      createdAt: new Date(pendingBaseCreatedAt.getTime() - 1000 * 60 * 60 * 24),
    },
    {
      email: 'chisom.nnaji@coop.com',
      staffId: 'FAAN-4003',
      name: 'Chisom Nnaji',
      status: 'PENDING' as const,
      department: 'Engineering',
      phone: '+2348123301144',
      monthlyContribution: 12000,
      balance: 0,
      totalContributions: 0,
      loanBalance: 0,
      bankName: 'Access Bank',
      bankAccountNumber: '0188844220',
      bankAccountName: 'CHISOM NNAJI',
      createdAt: pendingBaseCreatedAt,
    },
    {
      email: 'musa.abdullahi@coop.com',
      staffId: 'FAAN-4004',
      name: 'Musa Abdullahi',
      status: 'PENDING' as const,
      department: 'Fire & Safety',
      phone: '+2348097744001',
      monthlyContribution: 10000,
      balance: 0,
      totalContributions: 0,
      loanBalance: 0,
      bankName: 'First Bank',
      bankAccountNumber: '0611100223',
      bankAccountName: 'MUSA ABDULLAHI',
      createdAt: new Date(pendingBaseCreatedAt.getTime() + 1000 * 60 * 30),
    },
    {
      email: 'ifeoma.okoye@coop.com',
      staffId: 'FAAN-4005',
      name: 'Ifeoma Okoye',
      status: 'PENDING' as const,
      department: 'Finance',
      phone: '+2348109908803',
      monthlyContribution: 20000,
      balance: 0,
      totalContributions: 0,
      loanBalance: 0,
      bankName: 'GTBank',
      bankAccountNumber: '0233445566',
      bankAccountName: 'IFEOMA OKOYE',
      createdAt: new Date(pendingBaseCreatedAt.getTime() + 1000 * 60 * 60),
    },
  ]

  const createdMembers: Record<string, string> = {}

  for (const member of members) {
    const user = await prisma.user.upsert({
      where: { email: member.email },
      update: {
        name: member.name,
        staffId: member.staffId,
        password: defaultPassword,
        role: 'MEMBER',
        status: member.status,
        department: member.department,
        phone: member.phone,
        bankName: member.bankName,
        bankAccountNumber: member.bankAccountNumber,
        bankAccountName: member.bankAccountName,
        monthlyContribution: member.monthlyContribution,
        balance: member.balance,
        totalContributions: member.totalContributions,
        loanBalance: member.loanBalance,
        partialWithdrawalUsed: false,
        voucherEnabled: true,
        closureDate: null,
        createdAt: member.createdAt,
      },
      create: {
        email: member.email,
        name: member.name,
        staffId: member.staffId,
        password: defaultPassword,
        role: 'MEMBER',
        status: member.status,
        department: member.department,
        phone: member.phone,
        bankName: member.bankName,
        bankAccountNumber: member.bankAccountNumber,
        bankAccountName: member.bankAccountName,
        monthlyContribution: member.monthlyContribution,
        balance: member.balance,
        totalContributions: member.totalContributions,
        loanBalance: member.loanBalance,
        partialWithdrawalUsed: false,
        voucherEnabled: true,
        closureDate: null,
        createdAt: member.createdAt,
      },
    })

    createdMembers[member.email] = user.id
  }

  const memberIds = Object.values(createdMembers)

  await prisma.repayment.deleteMany({ where: { loan: { userId: { in: memberIds } } } })
  await prisma.transaction.deleteMany({ where: { userId: { in: memberIds } } })
  await prisma.payment.deleteMany({ where: { userId: { in: memberIds } } })
  await prisma.loan.deleteMany({ where: { userId: { in: memberIds } } })
  await prisma.withdrawal.deleteMany({ where: { userId: { in: memberIds } } })
  await prisma.voucher.deleteMany({ where: { userId: { in: memberIds } } })
  await prisma.commodityRequest.deleteMany({ where: { userId: { in: memberIds } } })

  const paymentRows = [
    {
      userId: createdMembers['aisha.bello@coop.com'],
      type: 'CONTRIBUTION' as PaymentType,
      amount: 30000,
      date: new Date('2026-02-03T10:15:00Z'),
      status: 'PENDING' as const,
      notes: 'February contribution transfer pending confirmation.',
      transactionReference: 'NIP5829211037',
    },
    {
      userId: createdMembers['kemi.oshinowo@coop.com'],
      type: 'LOAN_REPAYMENT' as PaymentType,
      amount: 45000,
      date: new Date('2026-02-04T09:20:00Z'),
      status: 'PENDING' as const,
      notes: 'Partial repayment for Q1 facility.',
      transactionReference: 'NIP5028812941',
    },
    {
      userId: createdMembers['olumide.falola@coop.com'],
      type: 'SAVINGS' as PaymentType,
      amount: 50000,
      date: new Date('2026-02-05T12:45:00Z'),
      status: 'PENDING' as const,
      notes: 'Top-up to savings wallet via mobile banking.',
      transactionReference: 'NIP6061720094',
    },
    {
      userId: createdMembers['member@example.com'],
      type: 'CONTRIBUTION' as PaymentType,
      amount: 20000,
      date: new Date('2026-01-27T14:05:00Z'),
      status: 'APPROVED' as const,
      notes: 'January deduction confirmed.',
      transactionReference: 'SALJANCHI1042',
    },
    {
      userId: createdMembers['member@example.com'],
      type: 'SAVINGS' as PaymentType,
      amount: 35000,
      date: new Date('2026-01-31T09:40:00Z'),
      status: 'APPROVED' as const,
      notes: 'Savings top-up via USSD transfer.',
      transactionReference: 'USSD9182710012',
    },
    {
      userId: createdMembers['member@example.com'],
      type: 'LOAN_REPAYMENT' as PaymentType,
      amount: 15000,
      date: new Date('2026-02-05T16:20:00Z'),
      status: 'PENDING' as const,
      notes: 'Repayment transfer awaiting admin verification.',
      transactionReference: 'MOB7281901011',
    },
    {
      userId: createdMembers['tunde.adeyemi@coop.com'],
      type: 'REGISTRATION' as PaymentType,
      amount: 10000,
      date: new Date('2026-01-20T11:30:00Z'),
      status: 'APPROVED' as const,
      notes: 'Initial membership registration fee.',
      transactionReference: 'REG1029TUNDE',
    },
    {
      userId: createdMembers['emeka.nwosu@coop.com'],
      type: 'CONTRIBUTION' as PaymentType,
      amount: 22000,
      date: new Date('2026-02-01T08:50:00Z'),
      status: 'REJECTED' as const,
      notes: 'Amount mismatch in proof upload.',
      transactionReference: 'NIP0038192281',
    },
  ]

  for (const payment of paymentRows) {
    const created = await prisma.payment.create({
      data: {
        userId: payment.userId,
        type: payment.type,
        amount: payment.amount,
        date: payment.date,
        proofImage: `https://proofs.coop.local/${payment.transactionReference}.jpg`,
        transactionReference: payment.transactionReference,
        status: payment.status,
        notes: payment.notes,
        reviewedBy: payment.status === 'PENDING' ? null : admin.name,
        reviewedAt: payment.status === 'PENDING' ? null : new Date(payment.date.getTime() + 3600000),
      },
    })

    await prisma.transaction.create({
      data: {
        userId: payment.userId,
        type: mapPaymentTypeToTransactionType(payment.type),
        amount: payment.amount,
        status:
          payment.status === 'APPROVED'
            ? 'COMPLETED'
            : payment.status === 'REJECTED'
              ? 'FAILED'
              : 'PENDING',
        reference: `TRX-${created.id.slice(-8).toUpperCase()}`,
        description: payment.notes,
        paymentId: created.id,
      },
    })
  }

  const loanRows = [
    {
      userId: createdMembers['aisha.bello@coop.com'],
      amount: 350000,
      purpose: 'Shop inventory expansion for festive demand',
      duration: 10,
      status: 'PENDING' as const,
      createdAt: new Date('2026-02-06T10:10:00Z'),
    },
    {
      userId: createdMembers['kemi.oshinowo@coop.com'],
      amount: 500000,
      purpose: 'Working capital for micro-distribution channel',
      duration: 12,
      status: 'PENDING' as const,
      createdAt: new Date('2026-02-07T09:45:00Z'),
    },
    {
      userId: createdMembers['member@example.com'],
      amount: 220000,
      purpose: 'Medical support and family emergency expenses',
      duration: 8,
      status: 'PENDING' as const,
      createdAt: new Date('2026-02-08T13:00:00Z'),
    },
    {
      userId: createdMembers['member@example.com'],
      amount: 180000,
      purpose: 'Home renovation and essential repairs',
      duration: 9,
      status: 'APPROVED' as const,
      createdAt: new Date('2026-01-14T10:30:00Z'),
    },
    {
      userId: createdMembers['tunde.adeyemi@coop.com'],
      amount: 180000,
      purpose: 'Laptop purchase for field operations',
      duration: 6,
      status: 'PENDING' as const,
      createdAt: new Date('2026-02-09T15:20:00Z'),
    },
    {
      userId: createdMembers['olumide.falola@coop.com'],
      amount: 400000,
      purpose: 'Agricultural input financing',
      duration: 10,
      status: 'PENDING' as const,
      createdAt: new Date('2026-02-10T08:15:00Z'),
    },
    {
      userId: createdMembers['emeka.nwosu@coop.com'],
      amount: 150000,
      purpose: 'Motorbike maintenance for logistics routes',
      duration: 7,
      status: 'APPROVED' as const,
      createdAt: new Date('2026-01-28T12:00:00Z'),
    },
  ]

  const outstandingByUser: Record<string, number> = {}

  for (const loan of loanRows) {
    const interest = loan.amount * 0.05
    const total = loan.amount + interest

    const created = await prisma.loan.create({
      data: {
        userId: loan.userId,
        amount: loan.amount,
        purpose: loan.purpose,
        duration: loan.duration,
        status: loan.status,
        balance: loan.status === 'APPROVED' ? total : 0,
        monthlyPayment: total / loan.duration,
        totalRepayable: total,
        notes: loan.status === 'PENDING' ? 'Awaiting credit committee review.' : 'Approved and disbursed.',
        approvedBy: loan.status === 'APPROVED' ? admin.id : null,
        approvedAt: loan.status === 'APPROVED' ? new Date(loan.createdAt.getTime() + 7200000) : null,
        createdAt: loan.createdAt,
      },
    })

    if (loan.status === 'APPROVED') {
      outstandingByUser[loan.userId] = (outstandingByUser[loan.userId] || 0) + total

      await prisma.transaction.create({
        data: {
          userId: loan.userId,
          type: 'LOAN_DISBURSEMENT',
          amount: loan.amount,
          status: 'COMPLETED',
          reference: `TRX-LOAN-${created.id.slice(-6).toUpperCase()}`,
          description: `Loan disbursement: ${loan.purpose}`,
          createdAt: new Date(loan.createdAt.getTime() + 7500000),
        },
      })

      await prisma.repayment.create({
        data: {
          loanId: created.id,
          amount: total / loan.duration,
          date: new Date(loan.createdAt.getTime() + 1000 * 60 * 60 * 24 * 30),
        },
      })
    }
  }

  await prisma.user.updateMany({
    where: { id: { in: memberIds } },
    data: { loanBalance: 0 },
  })

  for (const [userId, outstanding] of Object.entries(outstandingByUser)) {
    await prisma.user.update({
      where: { id: userId },
      data: { loanBalance: outstanding },
    })
  }

  const nextMonthStart = new Date()
  nextMonthStart.setMonth(nextMonthStart.getMonth() + 1, 1)
  nextMonthStart.setHours(0, 0, 0, 0)

  await prisma.voucher.createMany({
    data: members.map((member) => ({
      userId: createdMembers[member.email],
      fullName: member.name,
      staffId: member.staffId,
      department: member.department,
      monthlyDeduction: member.monthlyContribution,
      effectiveStartDate: nextMonthStart,
      status: 'GENERATED',
      notes: 'Auto-generated monthly payroll deduction voucher.',
    })),
  })

  await prisma.withdrawal.createMany({
    data: [
      {
        userId: createdMembers['member@example.com'],
        type: 'PARTIAL',
        requestedAmount: 80000,
        approvedAmount: 80000,
        maxAllowedAtRequest: 112000,
        status: 'APPROVED',
        reason: 'School fees support',
        reviewedBy: admin.name,
        requestedAt: new Date('2026-02-02T10:00:00Z'),
        reviewedAt: new Date('2026-02-03T09:30:00Z'),
      },
      {
        userId: createdMembers['emeka.nwosu@coop.com'],
        type: 'FULL_DISCONTINUATION',
        requestedAmount: 125000,
        status: 'PENDING',
        reason: 'Relocation request',
        requestedAt: new Date('2026-02-10T08:40:00Z'),
      },
    ],
  })

  await prisma.commodityRequest.createMany({
    data: [
      {
        userId: createdMembers['member@example.com'],
        itemCategory: 'Television',
        itemModel: 'Samsung 55-inch UHD Smart TV',
        preferredBudget: 420000,
        preferredMonths: 12,
        contactPreference: 'WHATSAPP',
        notes: 'Need home delivery to Abuja.',
        status: 'PENDING',
      },
      {
        userId: createdMembers['aisha.bello@coop.com'],
        itemCategory: 'Smartphone',
        itemModel: 'iPhone 14 Pro 256GB',
        preferredBudget: 820000,
        preferredMonths: 10,
        contactPreference: 'BOTH',
        notes: 'Prefer official warranty.',
        status: 'OFFERED',
        adminQuotedPrice: 790000,
        adminApprovedMonths: 10,
        adminMonthlyRepayment: 79000,
        adminFeedback: 'Offer shared. Awaiting member confirmation.',
        reviewedBy: admin.name,
        reviewedAt: new Date('2026-02-08T14:20:00Z'),
      },
    ],
  })

  await prisma.transaction.createMany({
    data: [
      {
        userId: createdMembers['aisha.bello@coop.com'],
        type: 'CONTRIBUTION',
        amount: 30000,
        status: 'COMPLETED',
        reference: 'TRX-NG-001201',
        description: 'Monthly salary deduction contribution',
        createdAt: new Date('2026-01-15T09:00:00Z'),
      },
      {
        userId: createdMembers['kemi.oshinowo@coop.com'],
        type: 'SAVINGS',
        amount: 55000,
        status: 'COMPLETED',
        reference: 'TRX-NG-001202',
        description: 'Mobile app savings top-up',
        createdAt: new Date('2026-01-18T11:25:00Z'),
      },
      {
        userId: createdMembers['member@example.com'],
        type: 'LOAN_REPAYMENT',
        amount: 25000,
        status: 'COMPLETED',
        reference: 'TRX-NG-001203',
        description: 'Loan installment repayment',
        createdAt: new Date('2026-01-22T14:10:00Z'),
      },
      {
        userId: createdMembers['emeka.nwosu@coop.com'],
        type: 'WITHDRAWAL',
        amount: 40000,
        status: 'PENDING',
        reference: 'TRX-NG-001204',
        description: 'Requested partial savings withdrawal',
        createdAt: new Date('2026-02-02T10:35:00Z'),
      },
    ],
  })

  console.log('✅ Admin user created:', admin.email)
  console.log(`✅ Created/updated ${members.length} member profiles with Nigerian sample data`)
  console.log('✅ Seeded payment verifications, loan requests, member directory records, and transactions')
  console.log('\n🎉 Database seeded successfully!')
  console.log('\nLogin credentials are seeded for local development only.')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
