module.exports = {
  apps: [
    {
      name: 'manuale-staff',
      script: 'server/index.js',
      cwd: '/opt/manuale-staff',
      instances: 1,
      autorestart: true,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
  ],
};
