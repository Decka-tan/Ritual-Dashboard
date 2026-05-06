import { useEffect, useRef } from 'react'

const HERO_VIDEO_URL = 'https://stream.mux.com/Kec29dVyJgiPdtWaQtPuEiiGHkJIYQAVUJcNiIHUYeo.m3u8'
const HERO_POSTER_URL = 'https://image.mux.com/Kec29dVyJgiPdtWaQtPuEiiGHkJIYQAVUJcNiIHUYeo/thumbnail.webp?time=1'

export function HeroBackground() {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined

    let hls
    let destroyed = false
    let reverseFrame = 0
    let lastReverseTick = 0

    const stopReverseLoop = () => {
      if (reverseFrame) {
        window.cancelAnimationFrame(reverseFrame)
        reverseFrame = 0
      }
      lastReverseTick = 0
    }

    const playVideo = async () => {
      if (destroyed) return
      stopReverseLoop()
      video.muted = true
      video.defaultMuted = true
      video.playsInline = true
      video.playbackRate = 1

      try {
        await video.play()
      } catch {
        // Some browsers only allow autoplay after metadata/canplay is ready.
      }
    }

    const playReverseToStart = () => {
      if (destroyed || !Number.isFinite(video.duration) || video.duration <= 0) return

      video.pause()
      stopReverseLoop()

      const tick = (timestamp) => {
        if (destroyed) return
        if (!lastReverseTick) lastReverseTick = timestamp

        const deltaSeconds = Math.min((timestamp - lastReverseTick) / 1000, 0.08)
        lastReverseTick = timestamp
        video.currentTime = Math.max(0, video.currentTime - deltaSeconds)

        if (video.currentTime <= 0.04) {
          video.currentTime = 0
          playVideo()
          return
        }

        reverseFrame = window.requestAnimationFrame(tick)
      }

      reverseFrame = window.requestAnimationFrame(tick)
    }

    const attachNativeHls = () => {
      video.src = HERO_VIDEO_URL
      video.load()
      playVideo()
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      attachNativeHls()
    } else {
      import('hls.js/dist/hls.light.mjs')
        .then(({ default: Hls }) => {
          if (destroyed) return
          if (!Hls.isSupported()) {
            attachNativeHls()
            return
          }

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
        })
        .catch(attachNativeHls)
    }

    video.addEventListener('loadedmetadata', playVideo)
    video.addEventListener('canplay', playVideo)
    video.addEventListener('ended', playReverseToStart)

    return () => {
      destroyed = true
      stopReverseLoop()
      video.removeEventListener('loadedmetadata', playVideo)
      video.removeEventListener('canplay', playVideo)
      video.removeEventListener('ended', playReverseToStart)
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
        playsInline
        preload="auto"
        poster={HERO_POSTER_URL}
        aria-hidden="true"
      />
    </div>
  )
}
