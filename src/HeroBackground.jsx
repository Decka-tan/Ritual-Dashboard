export function HeroBackground() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
      <div className="absolute left-1/2 top-[-20%] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]" />
      <div className="absolute right-[-10%] top-[18%] h-[360px] w-[360px] rounded-full bg-accent/10 blur-[110px]" />
      <div className="absolute bottom-[-18%] left-[-10%] h-[420px] w-[420px] rounded-full bg-accent/10 blur-[120px]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,148,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,148,0.045)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,var(--color-bg)_72%)]" />
      <div className="absolute inset-0 bg-bg/70" />
    </div>
  )
}
