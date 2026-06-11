import { API_URL } from '../constants';
import { useApp } from '../context/AppContext';

export default function AdvisorPage() {
  const { aiAnalysis, setAiAnalysis, aiLoading, setAiLoading } = useApp();

  const handleGenerateAiAnalysis = async () => {
    setAiLoading(true);
    setAiAnalysis('');
    try {
      const res = await fetch(`${API_URL}/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        setAiAnalysis(data.analysis);
      } else {
        const errJ = await res.json();
        alert(errJ.error || 'AI analysis failed.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error during AI analysis: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h2>AI Financial Health Advisor</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                Evaluate your overall fiscal metrics, identify spending leakages, and query budget optimization directives.
              </p>
            </div>

            {/* AI Health Advisor Report Renders */}
            <div className="glass-panel card-content" style={{ minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>🛡️</span> AI Financial Health Advisor
                  </h3>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.25rem', margin: 0 }}>
                    Receive a full financial health diagnostic score and tactical action recommendations.
                  </p>
                </div>

                <button
                  onClick={handleGenerateAiAnalysis}
                  className="btn btn-primary"
                  disabled={aiLoading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {aiLoading ? 'Analyzing...' : 'Generate New Report'}
                </button>
              </div>

              {aiLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '3rem 0' }}>
                  <div style={{
                    width: '50px', height: '50px',
                    border: '4px solid var(--color-primary-glow)',
                    borderTopColor: 'var(--color-primary)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginBottom: '1rem'
                  }} />
                  <strong style={{ color: 'var(--color-primary)' }}>AI is gathering current database metrics...</strong>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    Evaluating budget caps, credit card limits, installments payload, and cash flows.
                  </span>
                </div>
              ) : aiAnalysis ? (
                <div style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255, 255, 255, 0.02)',
                  borderRadius: '10px',
                  padding: '1.5rem',
                  overflowY: 'auto',
                  maxHeight: '700px',
                  lineHeight: '1.6',
                  color: '#e2e8f0',
                  fontSize: '0.95rem'
                }}>
                  {/* We render standard markdown with pre-wrap or styled components */}
                  <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif' }}>
                    {aiAnalysis}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '4rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</span>
                  <strong>No Report Generated Yet</strong>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', maxWidth: '400px' }}>
                    Ensure your AI Provider settings are configured correctly under the **Settings** tab, and then click **Generate New Report** to begin.
                  </p>
                </div>
              )}
            </div>
          </div>
  );
}
