import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { api } from '../lib/api'

export function useApiData<T>(url: string, initialValue: T) {
  const [data, setData] = useState<T>(initialValue)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!url) {
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await api.get<T>(url)
      setData(response.data)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message ?? 'Unable to load data from the API.')
      } else {
        setError('Unable to load data from the API.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [url])

  useEffect(() => {
    let isMounted = true

    if (!url) {
      setIsLoading(false)
      setError(null)
      setData(initialValue)
      return () => {
        isMounted = false
      }
    }

    void (async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await api.get<T>(url)
        if (isMounted) {
          setData(response.data)
        }
      } catch (err) {
        if (!isMounted) {
          return
        }

        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.message ?? 'Unable to load data from the API.')
        } else {
          setError('Unable to load data from the API.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      isMounted = false
    }
  }, [url])

  return { data, isLoading, error, refetch: load, setData }
}
