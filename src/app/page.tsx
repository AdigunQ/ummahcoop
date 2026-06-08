import Link from 'next/link'
import { ArrowRight, HandCoins, PiggyBank, Wallet } from 'lucide-react'
import { UmmahLogo } from '@/components/brand/ummah-logo'

const featureCards = [
  {
    title: 'Thrift Saving',
    description: 'A steady monthly habit that keeps savings moving.',
    icon: PiggyBank,
  },
  {
    title: 'Special Savings',
    description: 'A separate bucket for goals you want to keep apart.',
    icon: Wallet,
  },
  {
    title: 'Loan Requests',
    description: 'Simple requests for when you need a little extra support.',
    icon: HandCoins,
  },
]

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07130d] text-[#f7f3ea]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(126,212,151,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,214,128,0.14),transparent_26%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:64px_64px]" />

      <div className="relative mx-auto flex min-h-screen max-w-4xl items-center px-6 py-10 lg:px-10">
        <section className="w-full space-y-7">
            <div className="inline-flex rounded-full border border-white/10 bg-white/8 px-4 py-2 text-[#f7f3ea] backdrop-blur">
              <UmmahLogo
                markClassName="h-7 w-7"
                textClassName="text-sm"
                compactText
              />
            </div>

            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#9fb7a3]">
                Making saving feel easy
              </p>
              <h1 className="max-w-xl text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
                Save today.
                <span className="block text-[#8bd49d]">Enjoy tomorrow.</span>
              </h1>
              <p className="max-w-xl text-base leading-7 text-[#d0ddcf] sm:text-lg">
                A clean, calm place to save a little at a time, keep goals separate, and ask for support when needed.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-[#8bd49d] px-5 py-3 text-sm font-semibold text-[#062012] transition hover:-translate-y-0.5 hover:bg-[#9ce3ad]"
              >
                Register
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                Sign in
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {featureCards.map((feature, index) => (
                <article
                  key={feature.title}
                  className="rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm transition duration-300"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <feature.icon className="h-5 w-5 text-[#8bd49d]" />
                  <h2 className="mt-4 text-sm font-semibold text-white">{feature.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#c7d6c8]">{feature.description}</p>
                </article>
              ))}
            </div>
        </section>
      </div>
    </main>
  )
}
