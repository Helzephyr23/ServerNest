"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <span className="mb-2 text-4xl">⚠️</span>
          <p className="text-lg font-medium">Something went wrong</p>
          <p className="text-sm text-muted-foreground">{this.state.error?.message || "An unexpected error occurred"}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
