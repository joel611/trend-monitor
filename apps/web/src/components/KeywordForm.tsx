import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { CreateKeywordRequest } from "@trend-monitor/types";

interface KeywordFormProps {
	onSubmit: (data: CreateKeywordRequest) => void;
	onCancel: () => void;
	isSubmitting?: boolean;
}

export function KeywordForm({ onSubmit, onCancel, isSubmitting }: KeywordFormProps) {
	const [name, setName] = useState("");
	const [aliases, setAliases] = useState("");
	const [tags, setTags] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const data: CreateKeywordRequest = {
			name: name.trim(),
			aliases: aliases
				.split(",")
				.map((a) => a.trim())
				.filter(Boolean),
			tags: tags
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean),
		};

		onSubmit(data);
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="name">Name *</Label>
				<Input
					id="name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					required
					placeholder="e.g., ElysiaJS"
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="aliases">Aliases (comma-separated)</Label>
				<Input
					id="aliases"
					value={aliases}
					onChange={(e) => setAliases(e.target.value)}
					placeholder="e.g., Elysia, elysia.js"
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="tags">Tags (comma-separated)</Label>
				<Input
					id="tags"
					value={tags}
					onChange={(e) => setTags(e.target.value)}
					placeholder="e.g., framework, backend"
				/>
			</div>

			<div className="flex justify-end space-x-3 pt-4">
				<Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
					Cancel
				</Button>
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? "Creating..." : "Create Keyword"}
				</Button>
			</div>
		</form>
	);
}
