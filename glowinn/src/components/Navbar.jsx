import { useEffect, useState } from 'react'
import { Cloudmark, MenuIcon } from './icons.jsx'
import './Navbar.css'

const LINKS = ['Home', 'Products', 'Our business', 'Clients', 'About']

const anchorFor = (label) => `#${label.toLowerCase().replace(/\s+/g, '-')}`

export default function Navbar() {
  const [active, setActive] = useState('Home') // which rail item is the inner pill
  const [open, setOpen] = useState(false)

  // Locks body scroll while the sheet is open; cleanup restores ''.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // No scroll listener — this navbar never changes surface.
  return (
    <header className="nav">
      <div className="nav__inner shell">
        <a className="nav__brand" href="#top">
          <Cloudmark />
          <span>Glowinn</span>
        </a>

        {/* The rail floats free of the bar and carries its own surface. The ACTIVE item is an
            inner pill inside it — this design's most identifiable piece of chrome. */}
        <nav className="nav__rail" aria-label="Primary">
          {LINKS.map((label) => (
            <a
              key={label}
              href={anchorFor(label)}
              className={active === label ? 'is-active' : ''}
              onClick={() => setActive(label)}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="nav__actions">
          <a className="nav__register" href="#register">
            Register
          </a>
          <a className="btn btn--ink" href="#buy">
            Buy Now
          </a>
        </div>

        <button
          className="nav__toggle"
          type="button"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((wasOpen) => !wasOpen)}
        >
          <MenuIcon open={open} />
        </button>
      </div>

      {open && (
        <div className="nav__sheet">
          {LINKS.map((label) => (
            <a
              key={label}
              href={anchorFor(label)}
              onClick={() => {
                setActive(label)
                setOpen(false)
              }}
            >
              {label}
            </a>
          ))}
          <a href="#register" onClick={() => setOpen(false)}>
            Register
          </a>
          {/* the sheet uses the PEARL variant, not ink */}
          <a className="btn btn--pearl" href="#buy" onClick={() => setOpen(false)}>
            Buy Now
          </a>
        </div>
      )}
    </header>
  )
}
