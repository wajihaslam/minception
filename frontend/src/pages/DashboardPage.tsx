import { useQuery } from '@tanstack/react-query'
import Layout from '@/components/Layout'
import apiClient from '@/lib/axios'
import type { ApiResponse } from '@/types'

interface DashboardStats {
  total_gateways: number
  active_gateways: number
  total_endpoints: number
  total_flavors: number
  total_requests: number
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-3xl font-bold text-white mt-2">{value.toLocaleString()}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DashboardStats>>('/admin/dashboard/stats')
      if (!data.success || !data.data) throw new Error(data.error?.message ?? 'Failed to load stats')
      return data.data
    },
  })

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>

        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 h-24" />
            ))}
          </div>
        )}

        {isError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
            <p className="text-red-400">Failed to load dashboard stats</p>
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="Total Gateways" value={stats.total_gateways} />
            <StatCard label="Active Gateways" value={stats.active_gateways} />
            <StatCard label="Total Endpoints" value={stats.total_endpoints} />
            <StatCard label="Total Flavors" value={stats.total_flavors} />
            <StatCard label="Total Requests" value={stats.total_requests} />
          </div>
        )}
      </div>
    </Layout>
  )
}
