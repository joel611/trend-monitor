import { Card } from "./ui/card";

interface StatsCardProps {
	title: string;
	value: string | number;
	trend?: {
		value: number;
		isPositive: boolean;
	};
}

export function StatsCard({ title, value, trend }: StatsCardProps) {
	return (
		<Card className="p-6">
			<div className="flex flex-col">
				<dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
				<dd className="mt-1 flex items-baseline">
					<span className="text-3xl font-semibold text-gray-900">{value}</span>
					{trend && (
						<span
							className={`ml-2 text-sm font-medium ${trend.isPositive ? "text-green-600" : "text-red-600"}`}
						>
							{trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
						</span>
					)}
				</dd>
			</div>
		</Card>
	);
}
