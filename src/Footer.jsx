export function Footer() {
  return (
    <>
      <section className="border-t border-border bg-surface px-6 py-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-12 md:flex-row">
          <div className="group relative h-48 w-48 shrink-0 overflow-hidden rounded-2xl border border-border">
            <div className="absolute inset-0 z-10 bg-accent/20 opacity-0 mix-blend-overlay transition-opacity duration-300 group-hover:opacity-100" />
            <img
              className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
              src="/pfp.jpg"
              alt="Decka-tan"
              loading="lazy"
            />
          </div>

          <div className="flex flex-col items-center text-center md:items-start md:text-left">
            <h2 className="mb-2 font-display text-3xl uppercase tracking-wide text-text-primary">
              Decka-chan
            </h2>
            <p className="mb-4 font-mono text-sm uppercase tracking-widest text-accent">Creator & Designer</p>
            <p className="mb-6 max-w-md leading-relaxed text-text-secondary">
              As known as Decka-chan in Ritual Discord. Cute anime girl on Ritual. Ritty on Ritual Discord. Passionate about graphic design, lettering, and vibe coding.
            </p>

            <div className="flex items-center gap-4">
              <a
                className="rounded-full border border-border px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors duration-300 hover:border-border hover:text-accent"
                href="https://github.com/Decka-tan"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
              <a
                className="rounded-full border border-border px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors duration-300 hover:border-border hover:text-accent"
                href="https://x.com/decka_chan"
                target="_blank"
                rel="noreferrer"
              >
                X
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-12 text-center font-mono text-xs uppercase tracking-[0.2em] text-text-secondary">
        <div className="mx-auto max-w-7xl px-8">
          <div className="mb-4">© 2026 Ritual Dashboard — All Rights Reserved</div>
          <div className="mb-3 flex flex-col items-center justify-center gap-2 text-[10px] opacity-60 md:flex-row md:gap-4">
            <span>Built with Vite, React and Tailwind</span>
            <span className="hidden md:inline">•</span>
            <span>Cached previews powered by Playwright</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 text-[10px] opacity-60 md:flex-row md:gap-4">
            <a href="https://github.com/Decka-tan" target="_blank" rel="noreferrer" className="transition-colors hover:text-accent">GitHub</a>
            <span>•</span>
            <a href="https://x.com/decka_chan" target="_blank" rel="noreferrer" className="transition-colors hover:text-accent">X / Twitter</a>
          </div>
          <div className="mt-4 text-[9px] opacity-40">Crafted by Decka-tan</div>
        </div>
      </footer>
    </>
  )
}
