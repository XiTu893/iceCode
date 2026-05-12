import React from 'react'
import ReactDOM from 'react-dom/client'

// 简单的欢迎界面
const App: React.FC = () => {
  const [version, setVersion] = React.useState<string>('Loading...')

  React.useEffect(() => {
    // @ts-ignore - electron API will be available at runtime
    window.electron?.getAppVersion().then((v: string) => {
      setVersion(v)
    }).catch(() => {
      setVersion('Unknown')
    })
  }, [])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white'
    }}>
      <h1 style={{ fontSize: '48px', margin: '0 0 20px 0' }}>🧊 IceCode IDE</h1>
      <p style={{ fontSize: '18px', opacity: 0.9 }}>AI Coding Agent Desktop Application</p>
      <p style={{ fontSize: '14px', opacity: 0.7 }}>Version: {version}</p>
      
      <div style={{ marginTop: '40px', textAlign: 'center' }}>
        <p style={{ fontSize: '16px', marginBottom: '20px' }}>
          Backend service is running on port 50051
        </p>
        <div style={{
          padding: '15px 30px',
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '8px',
          backdropFilter: 'blur(10px)'
        }}>
          <p style={{ margin: '5px 0' }}>✨ Use the CLI in your terminal:</p>
          <code style={{ 
            background: 'rgba(0,0,0,0.3)',
            padding: '5px 10px',
            borderRadius: '4px',
            fontFamily: 'monospace'
          }}>
            icecode
          </code>
        </div>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
