/** @type {import("next").NextConfig} */
const nextConfig = {
  // Keep the dev-only indicator away from the sidebar language switcher.
  devIndicators: {
    position: "bottom-right"
  },
  poweredByHeader: false
};

export default nextConfig;
