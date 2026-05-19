import { useState } from 'react';

interface MenuItem {
  href: string;
  label: string;
}

interface Props {
  items: MenuItem[];
  currentPath: string;
}

export default function MobileMenu({ items, currentPath }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
    // Prevent body scroll when menu is open
    if (!isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  };

  const closeMenu = () => {
    setIsOpen(false);
    document.body.style.overflow = '';
  };

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={toggleMenu}
        className="mobile-menu-button"
        aria-label="Toggle menu"
        aria-expanded={isOpen}
      >
        <div className={`hamburger ${isOpen ? 'open' : ''}`}>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </button>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="mobile-menu-overlay" onClick={closeMenu}>
          <nav className="mobile-menu-nav" onClick={(e) => e.stopPropagation()}>
            <ul className="mobile-menu-list">
              {items.map((item) => {
                const isActive = currentPath === item.href ||
                  (item.href !== '/' && currentPath.startsWith(item.href));

                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className={`mobile-menu-link ${isActive ? 'active' : ''}`}
                      onClick={closeMenu}
                    >
                      {item.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
