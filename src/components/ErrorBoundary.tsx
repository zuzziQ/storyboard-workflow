import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 m-4 bg-red-950/20 border border-red-500/30 rounded-2xl text-center space-y-4 w-full">
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-full text-red-500">
            <AlertTriangle size={32} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white uppercase tracking-wider">
              {this.props.fallbackTitle || "Giao diện phân cảnh bị lỗi"}
            </h3>
            <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
              Phát hiện lỗi không mong muốn khi dựng layout. Giao diện đã được chặn sập (chống blank trang) để giữ an toàn dữ liệu kịch bản của Sếp.
            </p>
            {this.state.error && (
              <pre className="mt-3 p-2 bg-slate-950/80 rounded border border-slate-900 text-[10px] text-red-400 font-mono text-left max-w-lg mx-auto overflow-x-auto whitespace-pre-wrap">
                {this.state.error.toString()}
              </pre>
            )}
          </div>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 border border-red-500/30"
          >
            <RefreshCw size={14} />
            <span>Tải Lại Trang</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
