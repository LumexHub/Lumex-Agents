import React from "react"
import SentimentGauge from "./SentimentGauge"
import AssetOverviewPanel from "./AssetOverviewPanel"
import WhaleTrackerCard from "./WhaleTrackerCard"

export const Dashboard: React.FC = () => {
  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <h1 className="text-4xl font-bold mb-6">Analytics Dashboard</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SentimentGauge symbol="SOL" />
        <AssetOverviewPanel assetId="solana-main" />
        <WhaleTrackerCard />
      </div>
    </div>
  )
}

export default Dashboard
