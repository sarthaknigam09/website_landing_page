import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, User, Phone, CheckCircle2 } from 'lucide-react';
import { AuthPageLayout } from '../components/AuthPageLayout';
import { authService } from '../services/authService';

const SIGNUP_COOLDOWN_SECONDS = 30;

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;

    const intervalId = setInterval(() => {
      setCooldown((remaining) => remaining - 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0) return;
    setErrorMessage(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedMobile = mobile.trim();

    if (!trimmedName || !trimmedEmail || !trimmedMobile || !password || !confirmPassword) {
      setErrorMessage('Please fill in all fields');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    const mobileDigits = trimmedMobile.replace(/\D/g, '');
    if (mobileDigits.length < 10) {
      setErrorMessage('Please enter a valid mobile number');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await authService.signUp(trimmedEmail, password, {
        fullName: trimmedName,
        mobile: trimmedMobile,
        plan: 'b2c',
      });
      setShowSuccessDialog(true);
    } catch (err: any) {
      const message = err.message || 'Registration failed. Please try again.';
      setErrorMessage(message);
      if (message.startsWith('Too many sign-up attempts')) {
        setCooldown(SIGNUP_COOLDOWN_SECONDS);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageLayout
      title="Create account"
      subtitle="Join MoneyMapper to track your financial health"
      showBack
      maxWidth="md"
    >
      <div className="bg-[#0D0E15] border border-[#27272A] rounded-[24px] p-6 sm:p-8 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {errorMessage && (
            <div
              role="alert"
              className="p-4 rounded-[16px] bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium"
            >
              {errorMessage}
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="register-fullname"
              className="block text-sm font-medium text-white/90"
            >
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40">
                <User className="w-5 h-5" />
              </div>
              <input
                id="register-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                placeholder="John Doe"
                autoComplete="name"
                className="w-full pl-11 pr-4 py-3.5 bg-white/[0.04] border border-[#27272A] rounded-[16px] text-white placeholder-white/30 focus:outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] transition-all text-sm disabled:opacity-50"
              />
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-1.5">
            <label
              htmlFor="register-email"
              className="block text-sm font-medium text-white/90"
            >
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40">
                <Mail className="w-5 h-5" />
              </div>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                placeholder="name@example.com"
                autoComplete="email"
                className="w-full pl-11 pr-4 py-3.5 bg-white/[0.04] border border-[#27272A] rounded-[16px] text-white placeholder-white/30 focus:outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] transition-all text-sm disabled:opacity-50"
              />
            </div>
          </div>

          {/* Mobile Number */}
          <div className="space-y-1.5">
            <label
              htmlFor="register-mobile"
              className="block text-sm font-medium text-white/90"
            >
              Mobile Number
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40">
                <Phone className="w-5 h-5" />
              </div>
              <input
                id="register-mobile"
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                disabled={loading}
                placeholder="+91 98765 43210"
                autoComplete="tel"
                className="w-full pl-11 pr-4 py-3.5 bg-white/[0.04] border border-[#27272A] rounded-[16px] text-white placeholder-white/30 focus:outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] transition-all text-sm disabled:opacity-50"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="register-password"
              className="block text-sm font-medium text-white/90"
            >
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40">
                <Lock className="w-5 h-5" />
              </div>
              <input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="••••••••"
                autoComplete="new-password"
                className="w-full pl-11 pr-12 py-3.5 bg-white/[0.04] border border-[#27272A] rounded-[16px] text-white placeholder-white/30 focus:outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] transition-all text-sm disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/40 hover:text-white/80 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="register-confirm-password"
              className="block text-sm font-medium text-white/90"
            >
              Confirm Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40">
                <Lock className="w-5 h-5" />
              </div>
              <input
                id="register-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                placeholder="••••••••"
                autoComplete="new-password"
                className="w-full pl-11 pr-12 py-3.5 bg-white/[0.04] border border-[#27272A] rounded-[16px] text-white placeholder-white/30 focus:outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] transition-all text-sm disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/40 hover:text-white/80 transition-colors"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || cooldown > 0}
            className="w-full mt-4 py-3.5 px-4 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold rounded-[16px] transition-all duration-200 shadow-lg shadow-[#4F46E5]/25 disabled:opacity-60 flex items-center justify-center text-sm"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : cooldown > 0 ? (
              `Try again in ${cooldown}s`
            ) : (
              'Register'
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-[#27272A] text-center">
          <Link
            to="/login"
            className="text-sm text-white/80 hover:text-white transition-colors"
          >
            Already have an account? Login
          </Link>
        </div>
      </div>

      {/* Registration Success Modal mirroring Flutter AlertDialog */}
      {showSuccessDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="success-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="w-full max-w-md bg-[#0D0E15] border border-[#27272A] rounded-[24px] p-6 sm:p-8 shadow-2xl text-left">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 shrink-0" />
              <h2
                id="success-dialog-title"
                className="text-lg font-bold text-white tracking-wide"
              >
                Registration Successful
              </h2>
            </div>
            <p className="text-white/70 text-sm leading-relaxed mb-6">
              Your account has been created! Please check your email inbox to verify your account before logging in.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-[16px] transition-colors text-sm"
            >
              Back to Login
            </button>
          </div>
        </div>
      )}
    </AuthPageLayout>
  );
};

export default RegisterPage;
