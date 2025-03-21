module.exports = {
  webpack: {
    configure: {
      ignoreWarnings: [
        {
          module: /dag-jose/,
          message: /Failed to parse source map/,
        },
      ],
    },
  },
};