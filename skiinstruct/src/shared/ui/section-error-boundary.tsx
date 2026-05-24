"use client";

import React, { Component, type ReactNode } from "react";

import { Button } from "@/shared/ui/button";

type Props = {
  children: ReactNode;
  title?: string;
};

type State = { error: Error | null; retryKey: number };

/** Локальная ошибка блока — не роняет всю страницу. */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">{this.props.title ?? "Не удалось показать блок"}</p>
          <p className="mt-1 text-muted-foreground">{this.state.error.message}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => this.setState((s) => ({ error: null, retryKey: s.retryKey + 1 }))}
          >
            Повторить
          </Button>
        </div>
      );
    }
    const child = this.props.children;
    if (this.state.retryKey === 0) return child;
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { key: this.state.retryKey });
    }
    return child;
  }
}
