import React, { useEffect, useState } from "react"

interface AssetOverviewPanelProps {
  assetId: string
  apiBase?: string
}

interface AssetOverview {
  name: string
  priceUsd: number
  supply: number
  holders: number
  updatedAt?: string
}

export const AssetOverviewPanel: React.FC<AssetOverviewPanelProps> = ({
  assetId,
  apiBase = "/api/assets",
}) => {
  const [info, setInfo] = useState<AssetOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let cancelled = false
    async function fetchInfo() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${apiBase}/${encodeURIComponent(assetId)}`)
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const json = (await res.json()) as AssetOverview
        if (!cancelled) {
          setInfo(json)
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to fetch asset")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchInfo()
    return () => {
      cancelled = true
    }
  }, [assetId, apiBase])

  if (loading) {
    return <div className="p-4 text-gray-500">Loading asset overview…</div>
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded">
        Error loading asset: {error}
      </div>
    )
  }

  if (!info) {
    return (
      <div className="p-4 text-gray-600">
        No asset data available for ID <strong>{assetId}</strong>
      </div>
    )
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-semibold mb-2">Asset Overview</h2>
      <p>
        <strong>ID:</strong> {assetId}
      </p>
      <p>
        <strong>Name:</strong> {info.name}
      </p>
      <p>
        <strong>Price (USD):</strong> ${info.priceUsd.toFixed(2)}
      </p>
      <p>
        <strong>Circulating Supply:</strong> {info.supply.toLocaleString()}
      </p>
      <p>
        <strong>Holders:</strong> {info.holders.toLocaleString()}
      </p>
      {info.updatedAt && (
        <p className="text-sm text-gray-500">
          Updated at: {new Date(info.updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  )
}

export default AssetOverviewPanel
