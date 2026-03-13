const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
const repoName = 'FInCal--Hackathon';
const basePath = isGithubActions ? `/${repoName}` : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath,
  assetPrefix: basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
