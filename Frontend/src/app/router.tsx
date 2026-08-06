/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";
import { Suspense, lazy } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { PublicOnly, RequireAuth } from "./guards";
import { HomePage } from "@/pages/HomePage";

const LoginPage = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const ListingDetailPage = lazy(() =>
  import("@/pages/ListingDetailPage").then((m) => ({ default: m.ListingDetailPage }))
);
const SetupPage = lazy(() => import("@/pages/SetupPage").then((m) => ({ default: m.SetupPage })));
const UserProfilePage = lazy(() =>
  import("@/pages/UserProfilePage").then((m) => ({ default: m.UserProfilePage }))
);
const CheckoutSuccessPage = lazy(() =>
  import("@/pages/CheckoutSuccessPage").then((m) => ({ default: m.CheckoutSuccessPage }))
);
const CheckoutCancelPage = lazy(() =>
  import("@/pages/CheckoutCancelPage").then((m) => ({ default: m.CheckoutCancelPage }))
);

const fallback = (
  <div
    style={{ padding: "80px 0", textAlign: "center", color: "var(--color-fg-muted)" }}
    role="status"
  >
    Loading&hellip;
  </div>
);

const withSuspense = (node: ReactNode) => <Suspense fallback={fallback}>{node}</Suspense>;

export const router = createBrowserRouter([
  {
    path: "/login",
    element: withSuspense(
      <PublicOnly>
        <LoginPage />
      </PublicOnly>
    ),
  },
  {
    path: "/checkout/success",
    element: withSuspense(<CheckoutSuccessPage />),
  },
  {
    path: "/checkout/cancel",
    element: withSuspense(<CheckoutCancelPage />),
  },
  {
    element: <RequireAuth />,
    children: [
      { path: "/setup", element: withSuspense(<SetupPage />) },
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <HomePage /> },
          { path: "/listing/:id", element: withSuspense(<ListingDetailPage />) },
          { path: "/user/:id", element: withSuspense(<UserProfilePage />) },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
