import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-950">
          <div className="mx-auto max-w-md rounded-2xl border border-red-300/30 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-950/30">
            <h2 className="text-xl font-semibold text-red-700 dark:text-red-300">
              Something went wrong
            </h2>
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-xl bg-red-600 px-5 py-2 text-sm font-medium text-white transition-all hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
