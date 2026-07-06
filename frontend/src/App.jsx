import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import React, { Suspense, lazy } from 'react';
import Layout from './components/Layout';
import Landing from './pages/Landing';

// Lazy load pages for performance (code splitting)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Organizations = lazy(() => import('./pages/Organizations'));
const Tenders = lazy(() => import('./pages/Tenders'));
const Search = lazy(() => import('./pages/Search'));
const DataImport = lazy(() => import('./pages/DataImport'));
const AnalysisReport = lazy(() => import('./pages/AnalysisReport'));
const Geographical = lazy(() => import('./pages/Geographical'));
const Investigation = lazy(() => import('./pages/Investigation'));
const NetworkGraph = lazy(() => import('./pages/NetworkGraph'));
const AiChat = lazy(() => import('./pages/AiChat'));
const RedFlagExplorer = lazy(() => import('./pages/RedFlagExplorer'));
const Insights = lazy(() => import('./pages/Insights'));
const Collusion = lazy(() => import('./pages/Collusion'));

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

// Simple elegant loader for Suspense fallback
const FallbackLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#666' }}>
    <div style={{ animation: 'spin 1s linear infinite', border: '3px solid #f3f3f3', borderTop: '3px solid #f97316', borderRadius: '50%', width: '30px', height: '30px' }}></div>
    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<FallbackLoader />}>
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
              <Route path="chat"        element={<AiChat />} />
              <Route path="redflag"     element={<RedFlagExplorer />} />
              <Route path="insights"    element={<Insights />} />
              <Route path="collusion"   element={<Collusion />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
