import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

const HERO_VIDEO_URL = 'https://stream.mux.com/Kec29dVyJgiPdtWaQtPuEiiGHkJIYQAVUJcNiIHUYeo.m3u8'
const HERO_POSTER_URL = 'https://image.mux.com/Kec29dVyJgiPdtWaQtPuEiiGHkJIYQAVUJcNiIHUYeo/thumbnail.webp?time=1'

export function HeroBackground() {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined

    let hls
    let destroyed = false

    const playVideo = async () => {
      if (destroyed) return
      video.muted = true
      video.defaultMuted = true
      video.playsInline = true

      try {
        await video.play()
      } catch {
        // Some browsers only allow autoplay after metadata/canplay is ready.
      }
    }

    const attachNativeHls = () => {
      video.src = HERO_VIDEO_URL
      video.load()
      playVideo()
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      attachNativeHls()
    } else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
      })

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(HERO_VIDEO_URL)
      })

      hls.on(Hls.Events.MANIFEST_PARSED, playVideo)

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data?.fatal) return

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad()
          return
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError()
          return
        }

        hls.destroy()
        attachNativeHls()
      })

      hls.attachMedia(video)
    } else {
      attachNativeHls()
    }

    video.addEventListener('loadedmetadata', playVideo)
    video.addEventListener('canplay', playVideo)

    return () => {
      destroyed = true
      video.removeEventListener('loadedmetadata', playVideo)
      video.removeEventListener('canplay', playVideo)
      if (hls) hls.destroy()
    }
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover object-bottom"
        autoPlay
        muted
        defaultMuted
        loop
        playsInline
        preload="auto"
        poster={HERO_POSTER_URL}
        aria-hidden="true"
      />
    </div>
  )
}
