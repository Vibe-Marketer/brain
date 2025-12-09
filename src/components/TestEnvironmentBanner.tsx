import { Link } from "react-router-dom";
import { RiAlertFill, RiExternalLinkLine } from "@remixicon/react";

/**
 * TestEnvironmentBanner - Shows ONLY on test.callvaultai.com
 *
 * This banner provides visual verification that:
 * 1. The test branch deployed successfully
 * 2. You're NOT on production (app.callvaultai.com)
 *
 * Detection: URL-based (no env vars needed)
 */
export function TestEnvironmentBanner() {
  // Only show on test subdomain
  const isTestEnv = typeof window !== 'undefined' &&
    (window.location.hostname.includes('test.') ||
     window.location.hostname === 'localhost' ||
     window.location.hostname === '127.0.0.1');

  // Don't render anything on production
  if (!isTestEnv) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white py-2 px-4 flex items-center justify-center gap-3 shadow-lg"
      style={{
        background: 'linear-gradient(90deg, #DC2626 0%, #B91C1C 50%, #DC2626 100%)',
        borderBottom: '3px solid #7F1D1D',
      }}
    >
      <RiAlertFill className="w-5 h-5 animate-pulse" />
      <span className="font-bold text-sm tracking-wide">
        TEST ENVIRONMENT — {window.location.hostname}
      </span>
      <Link
        to="/test-verification"
        className="ml-2 flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs font-medium transition-colors"
      >
        Verify Deployment
        <RiExternalLinkLine className="w-3 h-3" />
      </Link>
    </div>
  );
}
