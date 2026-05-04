import { useState } from 'react'

const navLinks = [
  { label: 'About', href: '#about' },
  { label: 'Apps', href: '#apps' },
]

export function Header({ onSubmitClick }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const closeMenu = () => setMobileMenuOpen(false)
  const openSubmit = () => {
    closeMenu()
    onSubmitClick?.()
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between bg-gradient-to-b from-bg via-bg/80 to-transparent px-6 py-6 backdrop-blur-md">
      <a href="#dashboard" className="group flex items-center" onClick={closeMenu} aria-label="Ritual Dashboard home">
        <img
          src="/ritual-wordmark.png"
          alt="Ritual Dashboard"
          className="h-10 w-auto object-contain transition-opacity duration-300 group-hover:opacity-80 sm:h-12"
        />
      </a>

      <nav className="hidden items-center gap-8 font-mono text-xs uppercase tracking-widest text-text-primary md:flex">
        {navLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target={link.external ? '_blank' : undefined}
            rel={link.external ? 'noreferrer' : undefined}
            className="hover:text-accent"
          >
            {link.label}
          </a>
        ))}
        <button
          className="text-accent hover:text-accent/80"
          type="button"
          onClick={openSubmit}
        >
          SUBMIT
        </button>
      </nav>

      <button
        className="p-2 text-text-primary hover:text-accent md:hidden"
        onClick={() => setMobileMenuOpen((open) => !open)}
        aria-label="Toggle menu"
        type="button"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {mobileMenuOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {mobileMenuOpen && (
        <>
          <button
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={closeMenu}
            aria-label="Close menu"
            type="button"
          />
          <div className="absolute right-6 top-20 z-50 w-64 rounded-2xl border border-border bg-surface shadow-2xl md:hidden">
            <nav className="space-y-2 p-4">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noreferrer' : undefined}
                  className="block rounded-lg px-3 py-2 font-mono text-xs uppercase tracking-wider text-text-primary hover:text-accent"
                  onClick={closeMenu}
                >
                  {link.label}
                </a>
              ))}
              <button
                className="block w-full rounded-lg px-3 py-2 text-left font-mono text-xs uppercase tracking-wider text-accent hover:text-accent/80"
                type="button"
                onClick={openSubmit}
              >
                SUBMIT
              </button>
            </nav>
          </div>
        </>
      )}
    </header>
  )
}
