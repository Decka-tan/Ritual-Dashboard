const HERO_VIDEO_URL = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260330_145725_08886141-ed95-4a8e-8d6d-b75eaadce638.mp4'

export function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none">
      <video
        className="absolute inset-0 h-full w-full scale-105 object-cover opacity-70 saturate-[1.15]"
        src={HERO_VIDEO_URL}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_32%,rgba(255,255,255,0.10),transparent_24%),radial-gradient(circle_at_50%_50%,transparent_0%,rgba(5,5,5,0.28)_45%,rgba(5,5,5,0.92)_92%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,0.38),rgba(5,5,5,0.22)_42%,rgba(5,5,5,0.96))]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:64px_64px] opacity-40" />
      <div className="absolute left-1/2 top-[-18%] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-accent/12 blur-[130px]" />
      <div className="absolute bottom-[-20%] right-[-8%] h-[420px] w-[420px] rounded-full bg-white/10 blur-[140px]" />
    </div>
  )
}
