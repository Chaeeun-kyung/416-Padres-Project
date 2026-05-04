import SplashView from './components/splash/SplashView'
import StateDashboard from './components/dashboard/StateDashboard'
import useAppStore from './store/useAppStore'

// "splash" shows US map/state entry
// "state" shows the full analysis dashboard
function App() {
  const view = useAppStore((state) => state.view)

  if (view === 'state') {
    return <StateDashboard />
  }

  return <SplashView />
}

export default App
