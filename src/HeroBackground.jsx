import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

const HERO_VIDEO_URL = 'https://stream.mux.com/Kec29dVyJgiPdtWaQtPuEiiGHkJIYQAVUJcNiIHUYeo.m3u8'

export function HeroBackground() {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = HERO_VIDEO_URL
      return undefined
    }

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true })
      hls.loadSource(HERO_VIDEO_URL)
      hls.attachMedia(video)
      return () => hls.destroy()
    }

    video.src = HERO_VIDEO_URL
    return undefined
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover object-bottom"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
    </div>
  )
}
