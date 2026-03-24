import { useEffect, useRef, useState } from 'react'
import useAppStore from '../store/useAppStore'
import SplashHero from './splash/SplashHero'
import USMapBackground from './splash/USMapBackground'

// Landing screen controller:
// - accepts a state selection from either the hero selector or map click
// - plays a short exit animation
// - then switches global app state into dashboard mode for that state
function SplashView() {
  const setSelectedStateCode = useAppStore((state) => state.setSelectedStateCode)
  const [isExiting, setIsExiting] = useState(false)
  const [selectedStateCode, setSelectedStateCodeLocal] = useState(null)
  const exitTimerRef = useRef(null)

  // Prevents timer leaks if user navigates away during animation.
  useEffect(() => {
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current)
      }
    }
  }, [])

  // Handles all state-entry paths (hero dropdown + map click).
  // We delay setting global selectedStateCode so the fade transition is visible.
  function handleStateSelect(stateCode) {
    if (isExiting) return
    setSelectedStateCodeLocal(stateCode)
    setIsExiting(true)
    exitTimerRef.current = setTimeout(() => {
      setSelectedStateCode(stateCode)
    }, 180)
  }

  return (
    <div className={`splash-page ${isExiting ? 'splash-page--exit' : ''}`}>
      <div className="splash-layout">
        <SplashHero
          selectedStateCode={selectedStateCode}
          onStateSelect={handleStateSelect}
          disabled={isExiting}
        />
        <USMapBackground selectedStateCode={selectedStateCode} onStateSelect={handleStateSelect} />
      </div>
    </div>
  )
}

export default SplashView
