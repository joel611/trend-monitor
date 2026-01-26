import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import type { SourceConfigWithHealth } from "@trend-monitor/types";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ActionButtons } from "./ActionButtons";
import { HealthBadge } from "./HealthBadge";
import { StatusToggle } from "./StatusToggle";

interface SourcesTableProps {
	sources: SourceConfigWithHealth[];
	onAddSource: () => void;
	onEditSource: (source: SourceConfigWithHealth) => void;
	onDeleteSource: (source: SourceConfigWithHealth) => void;
	onTriggerSource: (source: SourceConfigWithHealth) => void;
	onTriggerAll: () => void;
	isTriggeringAll?: boolean;
	triggeringSourceId?: string | null;
}

export function SourcesTable({
	sources,
	onAddSource,
	onEditSource,
	onDeleteSource,
	onTriggerSource,
	onTriggerAll,
	isTriggeringAll,
	triggeringSourceId,
}: SourcesTableProps) {
	const [globalFilter, setGlobalFilter] = useState("");

	const columns: ColumnDef<SourceConfigWithHealth>[] = [
		{
			accessorKey: "config.name",
			header: "Name",
			enableSorting: true,
			cell: ({ row }) => <div className="font-medium">{row.original.config.name}</div>,
		},
		{
			accessorKey: "config.url",
			header: "Feed URL",
			cell: ({ row }) => (
				<a
					href={row.original.config.url}
					target="_blank"
					rel="noopener noreferrer"
					className="text-blue-600 hover:underline text-sm truncate block max-w-md"
				>
					{row.original.config.url}
				</a>
			),
		},
		{
			accessorKey: "type",
			header: "Type",
			cell: ({ row }) => <span className="text-sm capitalize">{row.original.type}</span>,
		},
		{
			id: "enabled",
			header: "Status",
			cell: ({ row }) => <StatusToggle source={row.original} />,
		},
		{
			id: "health",
			header: "Health",
			cell: ({ row }) => <HealthBadge source={row.original} />,
		},
		{
			accessorKey: "lastFetchAt",
			header: "Last Fetch",
			enableSorting: true,
			cell: ({ row }) => {
				if (!row.original.lastFetchAt) {
					return <span className="text-sm text-gray-400">Never</span>;
				}
				const date = new Date(row.original.lastFetchAt);
				const now = new Date();
				const diffMs = now.getTime() - date.getTime();
				const diffMins = Math.floor(diffMs / 60000);
				const diffHours = Math.floor(diffMins / 60);
				const diffDays = Math.floor(diffHours / 24);

				let timeAgo = "";
				if (diffDays > 0) timeAgo = `${diffDays}d ago`;
				else if (diffHours > 0) timeAgo = `${diffHours}h ago`;
				else if (diffMins > 0) timeAgo = `${diffMins}m ago`;
				else timeAgo = "Just now";

				return (
					<span className="text-sm" title={date.toLocaleString()}>
						{timeAgo}
					</span>
				);
			},
		},
		{
			id: "actions",
			header: "",
			cell: ({ row }) => (
				<ActionButtons
					source={row.original}
					onEdit={onEditSource}
					onDelete={onDeleteSource}
					onTrigger={onTriggerSource}
					isTriggeringSource={triggeringSourceId === row.original.id}
				/>
			),
		},
	];

	const table = useReactTable({
		data: sources,
		columns,
		state: {
			globalFilter,
		},
		onGlobalFilterChange: setGlobalFilter,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	});

	return (
		<div className="space-y-4">
			<div className="flex justify-between items-center">
				<Input
					placeholder="Search sources..."
					value={globalFilter}
					onChange={(e) => setGlobalFilter(e.target.value)}
					className="max-w-sm"
				/>
				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={onTriggerAll}
						disabled={isTriggeringAll || sources.length === 0}
					>
						<RefreshCw className={`h-4 w-4 mr-2 ${isTriggeringAll ? "animate-spin" : ""}`} />
						Trigger All
					</Button>
					<Button onClick={onAddSource}>Add Source</Button>
				</div>
			</div>

			<div className="border rounded-lg">
				<table className="w-full">
					<thead className="bg-gray-50 border-b">
						{table.getHeaderGroups().map((headerGroup) => (
							<tr key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<th
										key={header.id}
										className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
									>
										{header.isPlaceholder
											? null
											: flexRender(header.column.columnDef.header, header.getContext())}
									</th>
								))}
							</tr>
						))}
					</thead>
					<tbody className="bg-white divide-y divide-gray-200">
						{table.getRowModel().rows.map((row) => (
							<tr key={row.id} className="hover:bg-gray-50">
								{row.getVisibleCells().map((cell) => (
									<td key={cell.id} className="px-4 py-4 whitespace-nowrap">
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
