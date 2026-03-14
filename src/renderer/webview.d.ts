import type React from "react";

type WebviewElement = HTMLElement & {
  src: string;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  getURL: () => string;
  getTitle: () => string;
  isLoading: () => boolean;
  loadURL: (url: string) => Promise<void>;
  reload: () => void;
  goBack: () => void;
  goForward: () => void;
  openDevTools: () => void;
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<WebviewElement>, WebviewElement> & {
        src?: string;
        partition?: string;
      };
    }
  }
}

export {};
