import { useState } from 'react'
import axios from 'axios'

function getApiErrorMessage(err: unknown) {
  if (!axios.isAxiosError(err)) {
    return 'Request failed.'
  }

  const data = err.response?.data
  if (typeof data === 'string' && data.trim()) {
    return data
  }

  if (data?.message) {
    return data.message
  }

  if (data?.errors && typeof data.errors === 'object') {
    const messages = Object.values(data.errors)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

    if (messages.length > 0) {
      return messages.join(' ')
    }
  }

  if (data?.title) {
    return data.title
  }

  return 'Request failed.'
}

export function useApiMutation() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const run = async <T>(action: () => Promise<T>, successMessage?: string) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await action()
      if (successMessage) {
        setSuccess(successMessage)
      }

      return result
    } catch (err) {
      setError(getApiErrorMessage(err))

      return null
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    isSubmitting,
    error,
    success,
    setError,
    setSuccess,
    clearMessages: () => {
      setError(null)
      setSuccess(null)
    },
    run,
  }
}
