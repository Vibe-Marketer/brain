import { Link } from "react-router-dom";
import { RiArrowLeftLine, RiCheckboxCircleFill, RiGitBranchLine } from "@remixicon/react";

/**
 * TestVerificationPage - Rick Roll deployment verification page
 *
 * This page exists ONLY to prove:
 * 1. The test branch deployed successfully
 * 2. Routing works correctly
 * 3. This is NOT production
 *
 * If you're seeing this on app.callvaultai.com, something went very wrong!
 */
export default function TestVerification() {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
  const isTestEnv = hostname.includes('test.') || hostname === 'localhost' || hostname === '127.0.0.1';

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-8"
      style={{
        background: isTestEnv
          ? 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 50%, #FCA5A5 100%)'
          : 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 50%, #86EFAC 100%)',
      }}
    >
      {/* Status Card */}
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full mb-8 border-4 border-red-500">
        <div className="flex items-center gap-3 mb-6">
          <RiGitBranchLine className="w-8 h-8 text-red-600" />
          <h1 className="text-3xl font-bold text-gray-900">
            Deployment Verification
          </h1>
        </div>

        {/* Environment Info */}
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-red-700 font-semibold mb-2">
            <RiCheckboxCircleFill className="w-5 h-5" />
            Test Environment Confirmed
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-600">Hostname:</dt>
            <dd className="font-mono text-red-600">{hostname}</dd>
            <dt className="text-gray-600">Environment:</dt>
            <dd className="font-mono text-red-600">{isTestEnv ? 'TEST' : 'PRODUCTION (!)'}</dd>
            <dt className="text-gray-600">Timestamp:</dt>
            <dd className="font-mono text-gray-700">{new Date().toISOString()}</dd>
          </dl>
        </div>

        {/* Success Message */}
        <div className="text-center mb-6">
          <p className="text-lg text-gray-700 mb-2">
            If you can see this page and the video below, the deployment is working correctly.
          </p>
          <p className="text-sm text-gray-500">
            This page should NOT appear on production (app.callvaultai.com).
          </p>
        </div>

        {/* Back Button */}
        <Link
          to="/"
          className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white py-3 px-6 rounded-xl font-medium transition-colors w-full"
        >
          <RiArrowLeftLine className="w-5 h-5" />
          Return to Application
        </Link>
      </div>

      {/* Rick Roll Video */}
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full border-4 border-red-500">
        <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">
          Deployment Celebration Video
        </h2>
        <div className="aspect-video rounded-xl overflow-hidden bg-black">
          <iframe
            width="100%"
            height="100%"
            src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1"
            title="Deployment Verification"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <p className="text-center text-gray-500 text-sm mt-4">
          Never gonna give you up, never gonna let your deployment down...
        </p>
      </div>
    </div>
  );
}
