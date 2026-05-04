const HERO_VIDEO_URL = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260330_145725_08886141-ed95-4a8e-8d6d-b75eaadce638.mp4'

export function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none">
      <video
        className="absolute inset-0 h-full w-full object-cover object-bottom"
        src={HERO_VIDEO_URL}
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
