import SplashView from './components/SplashView'
import StateDashboard from './components/StateDashboard'
import useAppStore from './store/useAppStore'

// Root view router:
// - "splash" shows US map/state entry
// - "state" shows the full analysis dashboard
function App() {
  const view = useAppStore((state) => state.view)

  if (view === 'state') {
    return <StateDashboard />
  }

  return <SplashView />
}

export default App
