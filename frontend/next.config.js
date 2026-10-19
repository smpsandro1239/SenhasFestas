/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

const connectSrc = [
  "'self'",
  apiOrigin,
  apiOrigin.replace(/^http/, 'ws'),
].join(' ');

// Em desenvolvimento, o webpack usa eval-source-map e o React não hidrata sem
// 'unsafe-eval'. Em produção o bundle não usa eval, logo o CSP mantém-se estrito.
const scriptSrc = isProd ? "'self' 'unsafe-inline'" : "'self' 'unsafe-inline' 'unsafe-eval'";

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Content-Security-Policy',
    value: `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src ${connectSrc}; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
];

if (isProd) {
  securityHeaders.push({ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' });
}

const assetHost = process.env.NEXT_PUBLIC_ASSET_HOST;
const remotePatterns = assetHost
  ? [{ protocol: 'https', hostname: assetHost }]
  : [];

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },

  images: {
    remotePatterns,
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },

  onDemandEntries: {
    maxInactiveAge: 25 * 60 * 1000,
    pagesBufferLength: 2,
  },
};

module.exports = nextConfig;