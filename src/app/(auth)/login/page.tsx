'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { UmmahLogo } from '@/components/brand/ummah-logo'

function getLoginErrorMessage(error?: string | null) {
  if (!error || error === 'undefined') {
    return 'Login failed. Please check your Staff ID or email and password.'
  }

  const normalized = error.trim()

  if (normalized === 'CredentialsSignin') {
    return 'Invalid email or password.'
  }

  return normalized
}

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [identifierError, setIdentifierError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const rawError = params.get('error')
    if (!rawError) return

    toast.error(getLoginErrorMessage(rawError))

    params.delete('error')
    const nextQuery = params.toString()
    router.replace(nextQuery ? `/login?${nextQuery}` : '/login')
  }, [router])

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIdentifierError(null)
    setPasswordError(null)

    const trimmedIdentifier = identifier.trim()
    if (!trimmedIdentifier) {
      setIdentifierError('Enter your Staff ID or email address.')
      return
    }

    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      return
    }

    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        identifier: trimmedIdentifier,
        password,
        redirect: false,
        callbackUrl: '/dashboard',
      })

      if (!result) {
        toast.error('Login service is unavailable. Please refresh and try again.')
        return
      }

      if (result.error || result.ok === false) {
        toast.error(getLoginErrorMessage(result?.error))
        return
      }

      toast.success('Login successful!')
      window.location.assign(result.url || '/dashboard')
    } catch (error) {
      toast.error('An error occurred during login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-600 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 animate-fadeIn">
        <div className="text-center mb-8">
          <UmmahLogo
            className="mx-auto mb-5 justify-center"
            markClassName="h-16 w-16"
            textClassName="text-left text-gray-900"
          />
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-gray-500 mt-2">Sign in to continue.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6" noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Staff ID or Email
            </label>
            <input
              type="text"
              name="identifier"
              placeholder="Enter your Staff ID or email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              spellCheck={false}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
            />
            {identifierError && (
              <p className="mt-1 text-sm text-red-600">{identifierError}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              name="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
            />
            {passwordError && (
              <p className="mt-1 text-sm text-red-600">{passwordError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary-500 text-white py-3 rounded-lg font-semibold hover:bg-primary-600 focus:ring-4 focus:ring-primary-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Need an account?{' '}
            <Link href="/register" className="text-primary-500 font-semibold hover:underline">
              Register here
            </Link>
          </p>
          <p className="text-sm text-gray-400 mt-4">Members can use Staff ID or email.</p>
        </div>
      </div>
    </div>
  )
}
