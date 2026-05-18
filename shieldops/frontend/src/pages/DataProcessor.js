import React, { useState } from 'react';
import { dataService } from '../services/authService';

export default function DataProcessor() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleProcess = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await dataService.process({ data: input });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Data Processing Service</h2>
        <span className="badge">mTLS Secured</span>
      </div>
      <div className="card">
        <h3>Submit Data for Processing</h3>
        <textarea
          rows={6}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder='Enter JSON payload, e.g. {"key": "value"}'
          className="textarea"
        />
        <button className="btn-primary" onClick={handleProcess} disabled={loading}>
          {loading ? 'Processing...' : 'Process Data'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {result && (
        <div className="card success-card">
          <h3>Processing Result</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
