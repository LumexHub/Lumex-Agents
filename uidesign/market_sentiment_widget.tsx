import React from "react"

interface MarketSentimentWidgetProps {
  sentimentScore: number // 0–100
  trend: "Bullish" | "Bearish" | "Neutral"
  dominantToken: string
  totalVolume24h: number
}

const getSentimentColor = (score: number) => {
  if (score >= 70) return "bg-green-500"
  if (score >= 40) return "bg-yellow-500"
  return "bg-red-500"
}

export const MarketSentimentWidget: React.FC<MarketSentimentWidgetProps> = ({
  sentimentScore,
  trend,
  dominantToken,
  totalVolume24h,
}) => {
  return (
    <div className="p-4 bg-white rounded-2xl shadow-md flex flex-col items-center">
      <h3 className="text-lg font-semibold mb-4">Market Sentiment</h3>

      <div className="flex flex-col items-center space-y-4">
        <div
          className={`flex items-center justify-center w-20 h-20 rounded-full text-white text-xl font-bold ${getSentimentColor(
            sentimentScore
          )}`}
        >
          {sentimentScore}%
        </div>

        <ul className="text-sm space-y-1 text-gray-700">
          <li>
            <strong>Trend:</strong> {trend}
          </li>
          <li>
            <strong>Dominant Token:</strong> {dominantToken}
          </li>
          <li>
            <strong>24h Volume:</strong> ${totalVolume24h.toLocaleString()}
          </li>
        </ul>
      </div>
    </div>
  )
}

export default MarketSentimentWidget
