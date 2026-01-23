import { Switch } from "../ui/switch";
import type { SourceConfigWithHealth } from "@trend-monitor/types";
import { useToggleSourceStatus } from "../../features/sources/mutations";

interface StatusToggleProps {
	source: SourceConfigWithHealth;
}

export function StatusToggle({ source }: StatusToggleProps) {
	const toggleMutation = useToggleSourceStatus();

	const handleToggle = (enabled: boolean) => {
		toggleMutation.mutate({ id: source.id, enabled });
	};

	return (
		<Switch
			checked={source.enabled}
			onCheckedChange={handleToggle}
			disabled={toggleMutation.isPending}
		/>
	);
}
