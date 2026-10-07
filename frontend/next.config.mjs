/** Browser requests stay on the frontend origin; Next.js forwards them to Python. */
const nextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGIN
    ? [process.env.ALLOWED_DEV_ORIGIN]
    : [],
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async rewrites() {
    const backendUrl = (
      process.env.BACKEND_URL || "http://127.0.0.1:8000"
    ).replace(/\/$/, "");
    return [
      { source: "/api/backend/:path*", destination: `${backendUrl}/:path*` },
    ];
  },
};
export default nextConfig;
