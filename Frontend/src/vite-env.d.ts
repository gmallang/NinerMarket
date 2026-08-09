/// <reference types="vite/client" />

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: { credential?: string }) => void;
  auto_select?: boolean;
  hd?: string;
  ux_mode?: "popup" | "redirect";
  login_uri?: string;
}

interface GoogleIdButtonOptions {
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "continue_with" | "signin_with" | "signup_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  width?: number;
}

interface GoogleAccountsId {
  initialize(config: GoogleIdConfiguration): void;
  renderButton(element: HTMLElement, options?: GoogleIdButtonOptions): void;
  disableAutoSelect?(): void;
}

interface Window {
  google?: {
    accounts?: {
      id: GoogleAccountsId;
    };
  };
}

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
