const path = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Specify the cache directory relative to project root
  cacheDirectory: path.join(__dirname, 'puppeteer-cache'),
}; 