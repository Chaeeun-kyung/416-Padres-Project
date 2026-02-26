import { useEffect, useRef, useState } from 'react'
import useAppStore from '../store/useAppStore'
import SplashHero from './splash/SplashHero'
import USMapBackground from './splash/USMapBackground'

function SplashView() {
  const setSelectedStateCode = useAppStore((state) => state.setSelectedStateCode)
  const [isExiting, setIsExiting] = useState(false)
  const [selectedStateCode, setSelectedStateCodeLocal] = useState(null)
  const exitTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current)
      }
    }
  }, [])

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
        <SplashHero selectedStateCode={selectedStateCode} onStateSelect={handleStateSelect} />
        <USMapBackground selectedStateCode={selectedStateCode} onStateSelect={handleStateSelect} />
      </div>
    </div>
  )
}

export default SplashView
