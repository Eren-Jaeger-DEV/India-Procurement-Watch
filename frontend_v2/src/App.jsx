import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Organizations from './pages/Organizations';
import Tenders from './pages/Tenders';
import Search from './pages/Search';
import DataImport from './pages/DataImport';
import AnalysisReport from './pages/AnalysisReport';
import Geographical from './pages/Geographical';
import Investigation from './pages/Investigation';
import NetworkGraph from './pages/NetworkGraph';
import AiChat from './pages/AiChat';
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', background: '#ffe6e6', color: '#cc0000', height: '100vh', fontFamily: 'monospace' }}>
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: 'pre-wrap', background: 'white', padding: '20px', border: '1px solid #ffcccc' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<Layout />}>
          <Route path="import" element={<DataImport />} />
          <Route path="report" element={<AnalysisReport />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="geo" element={<Geographical />} />
          <Route path="organizations" element={<Organizations />} />
          <Route path="tenders" element={<Tenders />} />
          <Route path="investigation" element={<Investigation />} />
          <Route path="search" element={<Search />} />
          <Route path="network" element={<NetworkGraph />} />
          <Route path="chat" element={<AiChat />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
