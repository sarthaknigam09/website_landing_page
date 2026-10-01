import { useState } from 'react';
import { useComingSoon } from '../context/ComingSoonContext';
import { navigateTo } from '../lib/navigation';
import { Menu, X } from 'lucide-react';
import logoImg from '../assets/logo.png';

export const Navbar: React.FC = () => {
  const { openComingSoon } = useComingSoon();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Home', name: 'Home' },
    { label: 'Features', name: 'Features' },
    { label: 'Insights', name: 'Insights' },
    { label: 'Pricing', name: 'Pricing' },
    { label: 'About Us', name: 'About Us', href: '/moneymapper-about.html' },
  ];

  const handleLinkClick = (name: string) => {
    openComingSoon(name);
    setMobileMenuOpen(false);
  };

  const handleLoginClick = () => {
    setMobileMenuOpen(false);
    navigateTo('/login');
  };

  const handleGetStartedClick = () => {
    setMobileMenuOpen(false);
    navigateTo('/register');
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0b0a14]/80 backdrop-blur-md border-b border-white/[0.06] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Left: Brand Logo & Name */}
        <div
          onClick={() => handleLinkClick('MoneyMapper Home')}
          className="flex items-center gap-3 cursor-pointer select-none group"
        >
          <img
            src={logoImg}
            alt="MoneyMapper"
            className="h-9 w-9 object-contain group-hover:scale-105 transition-transform duration-200"
          />
          <span className="text-xl font-bold tracking-tight text-white group-hover:text-white/90">
            MoneyMapper
          </span>
        </div>

        {/* Center: Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-8 lg:gap-10">
          {navLinks.map((link) =>
            link.href ? (
              <a
                key={link.name}
                href={link.href}
                className="text-sm font-medium text-white/70 hover:text-white transition-colors duration-150 cursor-pointer focus:outline-none"
              >
                {link.label}
              </a>
            ) : (
              <button
                key={link.name}
                onClick={() => handleLinkClick(link.name)}
                className="text-sm font-medium text-white/70 hover:text-white transition-colors duration-150 cursor-pointer focus:outline-none"
              >
                {link.label}
              </button>
            )
          )}
        </nav>

        {/* Right: Auth Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          <button
            id="nav-login-btn"
            onClick={handleLoginClick}
            className="px-5 py-2 text-sm font-medium text-white/90 bg-[#161426] hover:bg-[#1f1b36] hover:text-white border border-white/10 hover:border-white/25 rounded-full transition-all duration-150 focus:outline-none cursor-pointer"
          >
            Login
          </button>
          <button
            id="nav-get-started-btn"
            onClick={handleGetStartedClick}
            className="px-5 py-2 text-sm font-medium text-white bg-brand-gradient hover:opacity-95 active:scale-95 rounded-full shadow-lg shadow-brand-purple/25 transition-all duration-150 focus:outline-none cursor-pointer"
          >
            Get Started
          </button>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-white/70 hover:text-white rounded-lg focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0e0c1a] border-b border-white/10 px-6 py-4 space-y-3 animate-fade-in">
          {navLinks.map((link) =>
            link.href ? (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full text-left py-2 text-base font-medium text-white/80 hover:text-white"
              >
                {link.label}
              </a>
            ) : (
              <button
                key={link.name}
                onClick={() => handleLinkClick(link.name)}
                className="block w-full text-left py-2 text-base font-medium text-white/80 hover:text-white"
              >
                {link.label}
              </button>
            )
          )}
          <div className="pt-4 border-t border-white/10 flex flex-col gap-2.5">
            <button
              onClick={handleLoginClick}
              className="w-full py-2.5 text-center text-sm font-medium text-white/90 bg-[#161426] border border-white/10 rounded-full"
            >
              Login
            </button>
            <button
              onClick={handleGetStartedClick}
              className="w-full py-2.5 text-center text-sm font-medium text-white bg-brand-gradient rounded-full shadow-md shadow-brand-purple/20"
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;

