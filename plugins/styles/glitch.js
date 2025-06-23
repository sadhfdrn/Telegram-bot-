const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

class WatermarkStyler {
  constructor() {
    // Default style configuration matching your images
    this.defaultStyle = {
      text: 'Samuel',
      font: 'Arial', // You can change to 'Eagle Lake' if you have it installed
      fontSize: 48,
      fontColor: 'white',
      opacity: 0.48, // 48% from your settings
      rotation: -6, // -6° from your settings
      position: 'bottom-right',
      offsetX: 30, // Distance from right edge
      offsetY: 30, // Distance from bottom edge
      shadowColor: 'black',
      shadowOffset: 2,
      enableShadow: true,
      backgroundColor: null, // Optional background color
      borderWidth: 0,
      borderColor: 'black'
    };
  }

  /**
   * Apply watermark to video
   * @param {string} inputPath - Path to input video
   * @param {string} outputPath - Path to output video
   * @param {object} customStyle - Custom style overrides
   * @returns {Promise} - FFmpeg promise
   */
  applyToVideo(inputPath, outputPath, customStyle = {}) {
    const style = { ...this.defaultStyle, ...customStyle };
    const drawTextFilter = this._buildDrawTextFilter(style);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(drawTextFilter)
        .outputOptions([
          '-c:v libx264',
          '-c:a copy',
          '-preset fast',
          '-crf 23'
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg process started:', commandLine);
        })
        .on('progress', (progress) => {
          console.log(`Processing: ${progress.percent}% done`);
        })
        .on('end', () => {
          console.log('Watermark applied successfully!');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('Error:', err.message);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Apply watermark to image
   * @param {string} inputPath - Path to input image
   * @param {string} outputPath - Path to output image
   * @param {object} customStyle - Custom style overrides
   * @returns {Promise} - FFmpeg promise
   */
  applyToImage(inputPath, outputPath, customStyle = {}) {
    const style = { ...this.defaultStyle, ...customStyle };
    const drawTextFilter = this._buildDrawTextFilter(style);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(drawTextFilter)
        .outputOptions(['-q:v 2']) // High quality for images
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg process started:', commandLine);
        })
        .on('end', () => {
          console.log('Watermark applied to image successfully!');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('Error:', err.message);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Build the drawtext filter string
   * @private
   */
  _buildDrawTextFilter(style) {
    const position = this._calculatePosition(style.position, style.offsetX, style.offsetY);
    
    let filter = `drawtext=text='${style.text}'`;
    filter += `:fontsize=${style.fontSize}`;
    filter += `:fontcolor=${style.fontColor}@${style.opacity}`;
    filter += `:x=${position.x}`;
    filter += `:y=${position.y}`;
    
    // Add rotation (convert degrees to radians)
    if (style.rotation !== 0) {
      const radians = (style.rotation * Math.PI) / 180;
      filter += `:angle=${radians}`;
    }

    // Add font if specified
    if (style.font && style.font !== 'default') {
      filter += `:font='${style.font}'`;
    }

    // Add shadow effect
    if (style.enableShadow) {
      filter += `:shadowcolor=${style.shadowColor}`;
      filter += `:shadowx=${style.shadowOffset}`;
      filter += `:shadowy=${style.shadowOffset}`;
    }

    // Add background color if specified
    if (style.backgroundColor) {
      filter += `:box=1:boxcolor=${style.backgroundColor}`;
    }

    // Add border if specified
    if (style.borderWidth > 0) {
      filter += `:borderw=${style.borderWidth}`;
      filter += `:bordercolor=${style.borderColor}`;
    }

    return filter;
  }

  /**
   * Calculate position coordinates
   * @private
   */
  _calculatePosition(position, offsetX, offsetY) {
    const positions = {
      'top-left': { x: offsetX, y: offsetY },
      'top-right': { x: `w-tw-${offsetX}`, y: offsetY },
      'bottom-left': { x: offsetX, y: `h-th-${offsetY}` },
      'bottom-right': { x: `w-tw-${offsetX}`, y: `h-th-${offsetY}` },
      'center': { x: '(w-tw)/2', y: '(h-th)/2' },
      'top-center': { x: '(w-tw)/2', y: offsetY },
      'bottom-center': { x: '(w-tw)/2', y: `h-th-${offsetY}` }
    };

    return positions[position] || positions['bottom-right'];
  }

  /**
   * Create multiple watermark variations
   * @param {string} inputPath - Path to input file
   * @param {string} outputDir - Output directory
   * @param {array} variations - Array of style variations
   */
  async createVariations(inputPath, outputDir, variations) {
    const results = [];
    
    for (let i = 0; i < variations.length; i++) {
      const variation = variations[i];
      const outputPath = path.join(outputDir, `watermarked_${i + 1}.${this._getFileExtension(inputPath)}`);
      
      try {
        const isVideo = this._isVideoFile(inputPath);
        if (isVideo) {
          await this.applyToVideo(inputPath, outputPath, variation);
        } else {
          await this.applyToImage(inputPath, outputPath, variation);
        }
        results.push({ success: true, path: outputPath, variation });
      } catch (error) {
        results.push({ success: false, error: error.message, variation });
      }
    }
    
    return results;
  }

  /**
   * Utility methods
   * @private
   */
  _isVideoFile(filePath) {
    const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv'];
    const ext = path.extname(filePath).toLowerCase();
    return videoExtensions.includes(ext);
  }

  _getFileExtension(filePath) {
    return path.extname(filePath).substring(1);
  }

  /**
   * Get preset styles
   */
  getPresetStyles() {
    return {
      // Exact match to your images
      samuel: {
        text: 'Samuel',
        fontSize: 48,
        fontColor: 'white',
        opacity: 0.48,
        rotation: -6,
        position: 'bottom-right',
        offsetX: 30,
        offsetY: 30,
        enableShadow: true
      },
      
      // Additional preset variations
      subtle: {
        text: 'Watermark',
        fontSize: 32,
        fontColor: 'white',
        opacity: 0.3,
        rotation: 0,
        position: 'bottom-right',
        offsetX: 20,
        offsetY: 20,
        enableShadow: false
      },
      
      bold: {
        text: 'BRAND',
        fontSize: 64,
        fontColor: 'white',
        opacity: 0.8,
        rotation: 0,
        position: 'center',
        enableShadow: true,
        shadowOffset: 3
      },
      
      corner: {
        text: '© 2025',
        fontSize: 24,
        fontColor: 'white',
        opacity: 0.6,
        rotation: 0,
        position: 'bottom-left',
        offsetX: 15,
        offsetY: 15,
        enableShadow: true
      }
    };
  }
}

module.exports = WatermarkStyler;

// Usage Examples:
/*
const WatermarkStyler = require('./watermark-styler');

// Initialize
const watermarker = new WatermarkStyler();

// Apply exact style from your images
watermarker.applyToVideo('input.mp4', 'output.mp4')
  .then(() => console.log('Done!'))
  .catch(err => console.error(err));

// Custom style
const customStyle = {
  text: 'My Brand',
  fontSize: 56,
  fontColor: 'yellow',
  opacity: 0.7,
  rotation: -10
};

watermarker.applyToVideo('input.mp4', 'branded.mp4', customStyle);

// Apply to image
watermarker.applyToImage('photo.jpg', 'watermarked.jpg');

// Use preset styles
const presets = watermarker.getPresetStyles();
watermarker.applyToVideo('input.mp4', 'output.mp4', presets.samuel);
*/