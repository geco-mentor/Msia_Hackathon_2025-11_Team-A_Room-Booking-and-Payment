'use client'

import { useState, useEffect, useCallback } from 'react'

interface UnansweredQuery {
  id: string
  user_message: string
  user_id: string | null
  session_id: string | null
  confidence_score: number
  status: 'pending' | 'answered' | 'dismissed'
  admin_response: string | null
  responded_by: string | null
  responded_at: string | null
  created_at: string
}

const API_BASE_URL = process.env.NEXT_PUBLIC_BOOKING_API_URL || 'http://localhost:8000'

interface Props {
  adminId: string
}

export default function UnansweredQueries({ adminId }: Props) {
  const [queries, setQueries] = useState<UnansweredQuery[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'answered' | 'all'>('pending')
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [responseText, setResponseText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchQueries = useCallback(async () => {
    try {
      const statusParam = filter === 'all' ? '' : `?status=${filter}`
      const response = await fetch(`${API_BASE_URL}/api/v1/knowledge-base/unanswered-queries${statusParam}`)
      if (!response.ok) throw new Error('Failed to fetch queries')
      const data = await response.json()
      setQueries(data)
    } catch (err) {
      console.error('Error fetching queries:', err)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchQueries()
  }, [fetchQueries])

  const handleRespond = async (queryId: string) => {
    if (!responseText.trim()) return

    setSubmitting(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/knowledge-base/unanswered-queries/${queryId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_response: responseText,
          responded_by: adminId
        })
      })

      if (!response.ok) throw new Error('Failed to submit response')

      setRespondingTo(null)
      setResponseText('')
      await fetchQueries()
    } catch (err) {
      console.error('Error responding:', err)
      alert('Failed to submit response')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDismiss = async (queryId: string) => {
    if (!confirm('Are you sure you want to dismiss this query?')) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/knowledge-base/unanswered-queries/${queryId}/dismiss`, {
        method: 'POST'
      })

      if (!response.ok) throw new Error('Failed to dismiss')

      await fetchQueries()
    } catch (err) {
      console.error('Error dismissing:', err)
      alert('Failed to dismiss query')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getConfidenceColor = (score: number) => {
    if (score < 0.3) return 'bg-red-100 text-red-700'
    if (score < 0.5) return 'bg-orange-100 text-orange-700'
    if (score < 0.7) return 'bg-yellow-100 text-yellow-700'
    return 'bg-green-100 text-green-700'
  }

  const pendingCount = queries.filter(q => q.status === 'pending').length

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Escalated Customer Queries</h2>
            <p className="text-sm text-gray-600">
              Questions the AI couldn't answer confidently
              {pendingCount > 0 && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                  {pendingCount} pending
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="pending">Pending</option>
              <option value="answered">Answered</option>
              <option value="all">All</option>
            </select>
            <button
              onClick={fetchQueries}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading...</span>
        </div>
      ) : queries.length > 0 ? (
        <div className="divide-y divide-gray-200">
          {queries.map((query) => (
            <div key={query.id} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Query Info */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      query.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : query.status === 'answered'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {query.status}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getConfidenceColor(query.confidence_score)}`}>
                      {Math.round(query.confidence_score * 100)}% confidence
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(query.created_at)}
                    </span>
                  </div>

                  {/* Customer Question */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-3">
                    <p className="text-sm text-gray-500 mb-1">Customer asked:</p>
                    <p className="text-gray-900">{query.user_message}</p>
                  </div>

                  {/* Admin Response (if answered) */}
                  {query.status === 'answered' && query.admin_response && (
                    <div className="bg-blue-50 rounded-lg p-4 mb-3">
                      <p className="text-sm text-blue-600 mb-1">
                        Admin response ({query.responded_at ? formatDate(query.responded_at) : ''}):
                      </p>
                      <p className="text-gray-900">{query.admin_response}</p>
                    </div>
                  )}

                  {/* Response Form */}
                  {query.status === 'pending' && respondingTo === query.id && (
                    <div className="mt-3">
                      <textarea
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        placeholder="Type your response to this customer query..."
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => handleRespond(query.id)}
                          disabled={submitting || !responseText.trim()}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submitting ? 'Submitting...' : 'Submit Response'}
                        </button>
                        <button
                          onClick={() => {
                            setRespondingTo(null)
                            setResponseText('')
                          }}
                          className="px-4 py-2 text-gray-600 text-sm rounded-lg hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Note: This response will be stored for reference. Consider adding this information to your knowledge base documents.
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {query.status === 'pending' && respondingTo !== query.id && (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setRespondingTo(query.id)}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                    >
                      Respond
                    </button>
                    <button
                      onClick={() => handleDismiss(query.id)}
                      className="px-3 py-1.5 text-gray-600 text-sm rounded-lg hover:bg-gray-100 border border-gray-300"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-6 py-12 text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-medium">No escalated queries</p>
          <p className="text-sm mt-1">
            {filter === 'pending'
              ? 'All customer queries have been answered!'
              : 'No queries match your filter.'}
          </p>
        </div>
      )}
    </div>
  )
}
