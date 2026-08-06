import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useMarketStore } from "@/lib/store";
import { renderWithRouter } from "@/test/utils";
import { SetupPage } from "./SetupPage";

describe("SetupPage", () => {
  beforeEach(() => {
    useMarketStore.setState({ user: null });
  });

  it("renders the profile setup form", () => {
    renderWithRouter(<SetupPage />);
    expect(screen.getByText("Finish your profile")).toBeInTheDocument();
    expect(screen.getByText("Freshman")).toBeInTheDocument();
    expect(screen.getByText("Skip for now")).toBeInTheDocument();
  });
});
