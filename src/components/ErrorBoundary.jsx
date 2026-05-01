import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page">
          <div className="card">
            <div className="empty-state">
              <h2>Что-то пошло не так</h2>
              <p>
                Произошла ошибка внутри приложения. Пожалуйста, обновите страницу
                или попробуйте позже.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
