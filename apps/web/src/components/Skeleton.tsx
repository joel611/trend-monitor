import { Card } from "./ui/card";
import { Skeleton as SkeletonPrimitive } from "./ui/skeleton";

export function SkeletonCard() {
	return (
		<Card className="p-6">
			<SkeletonPrimitive className="h-4 w-24 mb-2" />
			<SkeletonPrimitive className="h-8 w-32" />
		</Card>
	);
}

export function SkeletonTable() {
	return (
		<div className="bg-white shadow-md rounded-lg overflow-hidden p-6">
			<div className="space-y-3">
				{[...Array(5)].map((_, i) => (
					<div key={i} className="flex items-center space-x-4">
						<SkeletonPrimitive className="h-4 flex-1" />
						<SkeletonPrimitive className="h-4 w-20" />
						<SkeletonPrimitive className="h-4 w-16" />
					</div>
				))}
			</div>
		</div>
	);
}
