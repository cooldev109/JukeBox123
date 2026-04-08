import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-jb-bg-primary flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <img src="/logo.png" alt="Smart JukeBox" className="h-16 mx-auto mb-4" />
            <p className="text-jb-text-primary text-lg mb-2">Something went wrong</p>
            <p className="text-jb-text-secondary text-sm mb-6">{this.state.error}</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: '' });
                window.location.href = '/';
              }}
              className="px-6 py-3 bg-jb-accent-green text-jb-bg-primary font-bold rounded-xl hover:opacity-90 transition-opacity"
            >
              Go Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
