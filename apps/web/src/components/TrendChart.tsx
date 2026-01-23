import type { TimeSeriesDataPoint } from "@trend-monitor/types";
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

interface TrendChartProps {
	data: TimeSeriesDataPoint[];
}

export function TrendChart({ data }: TrendChartProps) {
	if (data.length === 0) {
		return (
			<div className="h-64 flex items-center justify-center text-gray-500">No data to display</div>
		);
	}

	return (
		<ResponsiveContainer width="100%" height={300}>
			<LineChart data={data}>
				<CartesianGrid strokeDasharray="3 3" />
				<XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString()} />
				<YAxis />
				<Tooltip
					labelFormatter={(value) => new Date(value).toLocaleDateString()}
					formatter={(value: number | undefined) => [value ?? 0, "Mentions"]}
				/>
				<Line
					type="monotone"
					dataKey="count"
					stroke="#4f46e5"
					strokeWidth={2}
					dot={{ fill: "#4f46e5" }}
				/>
			</LineChart>
		</ResponsiveContainer>
	);
}
