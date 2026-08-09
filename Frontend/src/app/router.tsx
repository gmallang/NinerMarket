/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";
import { Suspense, lazy } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { PublicOnly, RequireAuth } from "./guards";
import { HomePage } from "@/pages/HomePage";

const LoginPage = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const AboutPage = lazy(() => import("@/pages/AboutPage").then((m) => ({ default: m.AboutPage })));
const PrivacyPage = lazy(() =>
  import("@/pages/PrivacyPage").then((m) => ({ default: m.PrivacyPage }))
);
const ErrorPage = lazy(() => import("@/pages/ErrorPage").then((m) => ({ default: m.ErrorPage })));
const ListingDetailPage = lazy(() =>
  import("@/pages/ListingDetailPage").then((m) => ({ default: m.ListingDetailPage }))
);
const SetupPage = lazy(() => import("@/pages/SetupPage").then((m) => ({ default: m.SetupPage })));
const UserProfilePage = lazy(() =>
  import("@/pages/UserProfilePage").then((m) => ({ default: m.UserProfilePage }))
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
    errorElement: withSuspense(<ErrorPage />),
    children: [
      {
        path: "/login",
        element: withSuspense(
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        ),
      },
      {
        path: "/about",
        element: withSuspense(<AboutPage />),
      },
      {
        path: "/privacy",
        element: withSuspense(<PrivacyPage />),
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
    ],
  },
]);
