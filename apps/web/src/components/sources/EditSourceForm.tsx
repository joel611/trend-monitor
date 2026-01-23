import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { apiClient } from "../../lib/api";
import { FeedPreview } from "./FeedPreview";
import type { SourceConfigWithHealth, FeedValidationResult } from "@trend-monitor/types";

interface EditSourceFormProps {
	source: SourceConfigWithHealth;
	onSuccess: () => void;
	onCancel: () => void;
}

export function EditSourceForm({ source, onSuccess, onCancel }: EditSourceFormProps) {
	const queryClient = useQueryClient();
	const [validation, setValidation] = useState<FeedValidationResult | null>(null);
	const [isValidating, setIsValidating] = useState(false);
	const [urlChanged, setUrlChanged] = useState(false);

	const validateMutation = useMutation({
		mutationFn: async (data: { url: string; customUserAgent?: string }) => {
			const response = await apiClient.api.sources.validate.post(data);
			return response.data;
		},
		onSuccess: (data) => {
			setValidation(data);
			setUrlChanged(false);
		},
	});

	const updateMutation = useMutation({
		mutationFn: async (data: { url?: string; name?: string; customUserAgent?: string }) => {
			const response = await apiClient.api.sources({ id: source.id }).put(data);
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sources"] });
			onSuccess();
		},
	});

	const form = useForm({
		defaultValues: {
			url: source.config.url,
			name: source.config.name,
			customUserAgent: source.config.customUserAgent || "",
		},
		onSubmit: async ({ value }) => {
			await updateMutation.mutateAsync(value);
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

	const handleUrlChange = (newUrl: string) => {
		form.setFieldValue("url", newUrl);
		if (newUrl !== source.config.url) {
			setUrlChanged(true);
			setValidation(null);
		} else {
			setUrlChanged(false);
		}
	};

	const canSave = !urlChanged || (urlChanged && validation?.valid);

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
						<div className="space-y-2 mt-1">
							<div className="flex gap-2">
								<Input
									id="url"
									type="url"
									placeholder="https://example.com/feed.xml"
									value={field.state.value}
									onChange={(e) => handleUrlChange(e.target.value)}
									required
								/>
								{urlChanged && (
									<Button
										type="button"
										onClick={handleValidate}
										disabled={!field.state.value || isValidating}
										variant="outline"
									>
										{isValidating ? "Validating..." : "Re-validate"}
									</Button>
								)}
							</div>
							{urlChanged && !validation && (
								<p className="text-sm text-yellow-600">
									URL changed - please re-validate before saving
								</p>
							)}
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
				<Button type="submit" disabled={!canSave || updateMutation.isPending}>
					{updateMutation.isPending ? "Saving..." : "Save Changes"}
				</Button>
			</div>
		</form>
	);
}
