"use client";

import { BandwidthStats } from "@/types/isp_customer_accounting";
import { formatBytes } from "@/lib/utils";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, TooltipProps } from "recharts";

interface BandwidthChartProps {
  data: BandwidthStats[];
}

export function BandwidthChart({ data }: BandwidthChartProps) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data}>
        <XAxis
          dataKey="period"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number | string) => formatBytes(Number(value))}
        />
        <Tooltip
          content={({ active, payload }: TooltipProps<number, string>) => {
            if (active && payload && payload.length) {
              const downloadValue = payload[0]?.value ?? 0;
              const uploadValue = payload[1]?.value ?? 0;
              return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col">
                      <span className="text-[0.70rem] uppercase text-muted-foreground">
                        Download
                      </span>
                      <span className="font-bold text-green-500">
                        {formatBytes(Number(downloadValue))}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[0.70rem] uppercase text-muted-foreground">
                        Upload
                      </span>
                      <span className="font-bold text-blue-500">
                        {formatBytes(Number(uploadValue))}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Line
          type="monotone"
          dataKey="download"
          stroke="#22c55e"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="upload"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

