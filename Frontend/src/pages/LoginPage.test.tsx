import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "@/test/utils";
import { LoginPage } from "./LoginPage";

describe("LoginPage", () => {
  it("renders the marketing side and sign-in entry points", () => {
    renderWithRouter(<LoginPage />);
    expect(screen.getByText("Your campus marketplace")).toBeInTheDocument();
    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
    expect(screen.getByText(/UNC Charlotte students, faculty/)).toBeInTheDocument();
  });

  it("rejects an invalid email with a field-level warning", async () => {
    const { user } = renderWithRouter(<LoginPage />);
    await user.click(screen.getByText("Sign up with your @charlotte.edu email instead"));
    const emailInput = screen.getByPlaceholderText("Email address (@charlotte.edu)");
    await user.type(emailInput, "anna@gmail.com");
    expect(screen.getByText(/Must be a @charlotte.edu email/)).toBeInTheDocument();
  });
});
