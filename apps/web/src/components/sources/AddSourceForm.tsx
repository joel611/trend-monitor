import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import type { FeedValidationResult } from "@trend-monitor/types";
import { useState } from "react";
import { useCreateSource } from "../../features/sources/mutations";
import { apiClient } from "../../lib/api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { FeedPreview } from "./FeedPreview";

interface AddSourceFormProps {
	onSuccess: () => void;
	onCancel: () => void;
}

export function AddSourceForm({ onSuccess, onCancel }: AddSourceFormProps) {
	const [validation, setValidation] = useState<FeedValidationResult | null>(null);
	const [isValidating, setIsValidating] = useState(false);

	const validateMutation = useMutation({
		mutationFn: async (data: { url: string; customUserAgent?: string }) => {
			const response = await apiClient.api.sources.validate.post(data);
			return response.data;
		},
		onSuccess: (data) => {
			setValidation(data);
		},
	});

	const createMutation = useCreateSource();

	const form = useForm({
		defaultValues: {
			url: "",
			name: "",
			customUserAgent: "",
		},
		onSubmit: async ({ value }) => {
			createMutation.mutate(
				{
					...value,
					type: "feed",
				},
				{
					onSuccess: () => {
						onSuccess?.();
					},
				},
			);
		},
	});

	const handleValidate = async () => {
		const url = form.getFieldValue("url");
		const customUserAgent = form.getFieldValue("customUserAgent");

		if (!url) return;

		setIsValidating(true);
		try {
			await validateMutation.mutateAsync({ url, customUserAgent });
		} finally {
			setIsValidating(false);
		}
	};

	// Pre-fill name from feed metadata
	if (validation?.valid && validation.metadata && !form.getFieldValue("name")) {
		form.setFieldValue("name", validation.metadata.title);
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<div>
				<Label htmlFor="url">Feed URL</Label>
				<form.Field name="url">
					{(field) => (
						<div className="flex gap-2 mt-1">
							<Input
								id="url"
								type="url"
								placeholder="https://example.com/feed.xml"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								required
							/>
							<Button
								type="button"
								onClick={handleValidate}
								disabled={!field.state.value || isValidating}
								variant="outline"
							>
								{isValidating ? "Validating..." : "Validate"}
							</Button>
						</div>
					)}
				</form.Field>
				{validation && !validation.valid && (
					<p className="text-sm text-red-600 mt-1">{validation.error}</p>
				)}
			</div>

			{validation?.valid && <FeedPreview validation={validation} />}

			<div>
				<Label htmlFor="name">Name</Label>
				<form.Field name="name">
					{(field) => (
						<Input
							id="name"
							type="text"
							placeholder="My Feed"
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							required
							className="mt-1"
						/>
					)}
				</form.Field>
			</div>

			<div>
				<Label htmlFor="customUserAgent">Custom User Agent (optional)</Label>
				<form.Field name="customUserAgent">
					{(field) => (
						<Input
							id="customUserAgent"
							type="text"
							placeholder="MyBot/1.0"
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							className="mt-1"
						/>
					)}
				</form.Field>
			</div>

			<div className="flex justify-end gap-2 pt-4">
				<Button type="button" variant="outline" onClick={onCancel}>
					Cancel
				</Button>
				<Button type="submit" disabled={!validation?.valid || createMutation.isPending}>
					{createMutation.isPending ? "Adding..." : "Add Source"}
				</Button>
			</div>
		</form>
	);
}
