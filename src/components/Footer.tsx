import React from 'react';
import { useComingSoon } from '../context/ComingSoonContext';
import { Lock, Shield } from 'lucide-react';
import logoImg from '../assets/logo.png';

// Custom Crisp SVGs matching Lucide stroke style for Brand Socials
const TwitterIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
  </svg>
);

const LinkedinIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.3a1.6 1.6 0 0 0-1.6 1.6 1.6 1.6 0 0 0 1.6 1.6 1.6 1.6 0 0 0 1.6-1.6 1.6 1.6 0 0 0-1.6-1.6z" />
  </svg>
);

const InstagramIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const YoutubeIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="#0d0a1a" />
  </svg>
);

export const Footer: React.FC = () => {
  const { openComingSoon } = useComingSoon();

  const socialLinks = [
    { name: 'Twitter', icon: TwitterIcon },
    { name: 'LinkedIn', icon: LinkedinIcon },
    { name: 'Instagram', icon: InstagramIcon },
    { name: 'YouTube', icon: YoutubeIcon },
  ];

  const productLinks = ['Features', 'Insights', 'AI Assistant', 'Pricing'];
  const companyLinks = ['About Us', 'Careers', 'Blog', 'Contact Us'];
  const supportLinks = [
    'Help Center',
    'FAQs',
    'Privacy Policy',
    'Terms of Service',
    'Cookie Policy',
    'Grievance Redressal Policy',
  ];

  const linkHrefs: Record<string, string> = {
    'Pricing': '/moneymapper-pricing.html',
    'Privacy Policy': '/privacy-policy.html',
    'Terms of Service': '/terms-and-conditions.html',
    'Cookie Policy': '/cookie-policy.html',
    'Grievance Redressal Policy': '/grievance-redressal-policy.html',
  };

  return (
    <footer className="relative bg-[#06040f] border-t border-white/[0.08] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-14 pb-8">
        
        {/* Main Footer Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8">
          
          {/* Left Column: Brand, Tagline & Socials */}
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2.5">
              <img
                src={logoImg}
                alt="MoneyMapper"
                className="w-7 h-7 sm:w-8 sm:h-8 object-contain"
              />
              <span className="text-xl font-bold text-white tracking-tight">MoneyMapper</span>
            </div>

            <p className="text-xs text-white/50 mt-3 mb-5 max-w-xs leading-relaxed">
              Your AI-Powered Financial Navigation System
            </p>

            {/* Circular Social Buttons */}
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <button
                    key={social.name}
                    onClick={() => openComingSoon(social.name)}
                    className="w-8 h-8 rounded-full bg-[#161326] border border-white/10 hover:border-brand-purple/50 flex items-center justify-center text-white/70 hover:text-white transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-sm"
                    aria-label={social.name}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Three Link Columns */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-8">
            
            {/* 1. Product */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 tracking-wide">Product</h3>
              <ul className="space-y-2">
                {productLinks.map((link) => {
                  const href = linkHrefs[link];
                  return (
                    <li key={link}>
                      {href ? (
                        <a
                          href={href}
                          className="text-xs text-white/50 hover:text-white transition-colors text-left py-0.5 w-full cursor-pointer"
                        >
                          {link}
                        </a>
                      ) : (
                        <button
                          onClick={() => openComingSoon(link)}
                          className="text-xs text-white/50 hover:text-white transition-colors text-left py-0.5 w-full cursor-pointer"
                        >
                          {link}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* 2. Company */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 tracking-wide">Company</h3>
              <ul className="space-y-2">
                {companyLinks.map((link) => (
                  <li key={link}>
                    <button
                      onClick={() => openComingSoon(link)}
                      className="text-xs text-white/50 hover:text-white transition-colors text-left py-0.5 w-full cursor-pointer"
                    >
                      {link}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* 3. Support */}
            <div className="col-span-2 sm:col-span-1">
              <h3 className="text-sm font-semibold text-white mb-3 tracking-wide">Support</h3>
              <ul className="space-y-2">
                {supportLinks.map((link) => {
                  const href = linkHrefs[link];
                  return (
                    <li key={link}>
                      {href ? (
                        <a
                          href={href}
                          className="text-xs text-white/50 hover:text-white transition-colors text-left py-0.5 w-full cursor-pointer"
                        >
                          {link}
                        </a>
                      ) : (
                        <button
                          onClick={() => openComingSoon(link)}
                          className="text-xs text-white/50 hover:text-white transition-colors text-left py-0.5 w-full cursor-pointer"
                        >
                          {link}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

          </div>

        </div>

        {/* Divider Line */}
        <div className="border-t border-white/[0.08] mt-12 mb-6" />

        {/* Bottom Bar: Copyright (left) & Security Badges (right) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <div>
            <span>© 2024 MoneyMapper. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            {/* SSL Secured Badge (Decorative, non-clickable) */}
            <div className="flex items-center gap-1.5 text-white/60 select-none">
              <div className="w-4 h-4 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Lock className="w-2.5 h-2.5 text-emerald-400" />
              </div>
              <span className="text-xs font-medium text-white/70">SSL Secured</span>
            </div>

            {/* Data Protected Badge (Decorative, non-clickable) */}
            <div className="flex items-center gap-1.5 text-white/60 select-none">
              <div className="w-4 h-4 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Shield className="w-2.5 h-2.5 text-emerald-400" />
              </div>
              <span className="text-xs font-medium text-white/70">Data Protected</span>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
