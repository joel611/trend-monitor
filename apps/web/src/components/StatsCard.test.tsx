import { describe, expect, it } from "bun:test";
import { render } from "@testing-library/react";
import "../__tests__/setup";
import { StatsCard } from "./StatsCard";

describe("StatsCard", () => {
	it("should render title and value", () => {
		const { getByText } = render(<StatsCard title="Total Mentions" value={42} />);
		expect(getByText("Total Mentions")).toBeTruthy();
		expect(getByText("42")).toBeTruthy();
	});

	it("should render trend when provided", () => {
		const { getByText } = render(
			<StatsCard title="Active Keywords" value={10} trend={{ value: 15, isPositive: true }} />,
		);
		expect(getByText("Active Keywords")).toBeTruthy();
		expect(getByText("10")).toBeTruthy();
		expect(getByText(/↑/)).toBeTruthy();
		expect(getByText(/15%/)).toBeTruthy();
	});
});
