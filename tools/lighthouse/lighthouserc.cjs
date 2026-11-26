// Initial reporting thresholds. All assertions warn until CI reproducibility is established.
module.exports = {
  ci: {
    assert: {
      assertions: {
        'largest-contentful-paint': ['warn', { maxNumericValue: 5000 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'resource-summary:script:size': ['warn', { maxNumericValue: 310000 }],
        'resource-summary:image:size': ['warn', { maxNumericValue: 1500000 }],
      },
    },
  },
}
