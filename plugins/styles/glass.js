const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

class GlassMorphismWatermarkStyler {
  constructor() {
    // Modern glassmorphism style configuration
    this.defaultStyle = {
      text: 'GLASS',
      font: 'Arial',
      fontSize: 46,
      textColor: '#ffffff',
      glassColor: '#ffffff',
      opacity: 0.15,
      textOpacity: 0.9,
      rotation: 0,
      position: 'center',
      offsetX: 0,
      offsetY: 0,
      blurIntensity: 12,
      borderRadius: 20,
      backdropBlur: true,
      gradientOverlay: true,
      shimmerEffect: false,
      pulseEffect: false,
      borderWidth: 1,
      borderOpacity: 0.3,
      padding: 25,
      shadowIntensity: 0.2
    };
  }

  /**
   * Apply glassmorphism watermark to video
   */
  applyToVideo(inputPath, outputPath, customStyle = {}) {
    const style = { ...this.defaultStyle, ...customStyle };
    const complexFilter = this._buildGlassFilter(style);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(complexFilter)
        .outputOptions([
          '-c:v libx264',
          '-c:a copy',
          '-preset medium',
          '-crf 20,
          '-pix_fmt yuv420p'
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('Glass effect processing started:', commandLine);
        })
        .on('progress', (progress) => {
          console.log(`Glass processing: ${progress.percent}% done`);
        })
        .on('end', () => {
          console.log('Glass watermark applied successfully!');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('Glass processing error:', err.message);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Apply glassmorphism watermark to image
   */
  applyToImage(inputPath, outputPath, customStyle = {}) {
    const style = { ...this.defaultStyle, ...customStyle };
    const filter = this._buildStaticGlassFilter(style);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(filter)
        .outputOptions(['-q:v 1'])
        .output(outputPath)
        .on('end', () => {
          console.log('Glass watermark applied to image!');
          resolve(outputPath);
        })
        .on('error', reject)
        .run();
    });
  }

  /**
   * Build complex glass filter for videos
   * @private
   */
  _buildGlassFilter(style) {
    const position = this._calculateGlassPosition(style);
    const filters = [];

    // Create the main video input
    filters.push('[0:v]split=2[main][blur]');
    
    // Create blurred background for glass effect
    filters.push(`[blur]crop=${position.width}:${position.height}:${position.x}:${position.y},gblur=sigma=${style.blurIntensity}[blurred_bg]`);
    
    // Create glass panel with gradient
    if (style.gradientOverlay) {
      filters.push(`[main]drawbox=x=${position.x}:y=${position.y}:w=${position.width}:h=${position.height}:color=${style.glassColor}@${style.opacity}:t=fill[glass_base]`);
      filters.push(`[glass_base]drawbox=x=${position.x}:y=${position.y}:w=${position.width}:h=${position.height/3}:color=${style.glassColor}@${style.opacity * 0.5}:t=fill[glass_gradient]`);
    } else {
      filters.push(`[main]drawbox=x=${position.x}:y=${position.y}:w=${position.width}:h=${position.height}:color=${style.glassColor}@${style.opacity}:t=fill[glass_gradient]`);
    }

    // Add border if specified
    if (style.borderWidth > 0) {
      filters.push(`[glass_gradient]drawbox=x=${position.x}:y=${position.y}:w=${position.width}:h=${position.height}:color=${style.glassColor}@${style.borderOpacity}:t=${style.borderWidth}[glass_border]`);
    } else {
      filters.push('[glass_gradient]null[glass_border]');
    }

    // Add text with effects
    const textFilter = this._createGlassText(style, position);
    filters.push(`[glass_border]${textFilter}[glass_complete]`);

    // Add shimmer effect if enabled
    if (style.shimmerEffect) {
      const shimmerFilter = this._createShimmerEffect(style, position);
      filters.push(`[glass_complete]${shimmerFilter}[final]`);
    } else {
      filters.push('[glass_complete]null[final]');
    }

    return filters.join(';');
  }

  /**
   * Build static glass filter for images
   * @private
   */
  _buildStaticGlassFilter(style) {
    const position = this._calculateGlassPosition(style);
    const filters = [];

    // Create glass background
    filters.push(`drawbox=x=${position.x}:y=${position.y}:w=${position.width}:h=${position.height}:color=${style.glassColor}@${style.opacity}:t=fill`);
    
    // Add gradient overlay
    if (style.gradientOverlay) {
      filters.push(`drawbox=x=${position.x}:y=${position.y}:w=${position.width}:h=${position.height/3}:color=${style.glassColor}@${style.opacity * 0.5}:t=fill`);
    }

    // Add border
    if (style.borderWidth > 0) {
      filters.push(`drawbox=x=${position.x}:y=${position.y}:w=${position.width}:h=${position.height}:color=${style.glassColor}@${style.borderOpacity}:t=${style.borderWidth}`);
    }

    // Add text
    const textFilter = this._createGlassText(style, position);
    filters.push(textFilter);

    return filters.join(',');
  }

  /**
   * Create glass text with frosted effects
   * @private
   */
  _createGlassText(style, position) {
    const textX = position.textX;
    const textY = position.textY;

    // Create multiple text layers for depth
    const layers = [];

    // Background text (slightly offset for depth)
    layers.push(`drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.textColor}@${style.textOpacity * 0.3}:x=${textX + 2}:y=${textY + 2}:font='${style.font}'`);
    
    // Main text
    layers.push(`drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.textColor}@${style.textOpacity}:x=${textX}:y=${textY}:font='${style.font}'`);
    
    // Highlight text (for glass effect)
    layers.push(`drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.textColor}@${style.textOpacity * 0.4}:x=${textX}:y=${textY - 1}:font='${style.font}'`);

    return layers.join(',');
  }

  /**
   * Create shimmer animation effect
   * @private
   */
  _createShimmerEffect(style, position) {
    const shimmerWidth = 30;
    const animationSpeed = 2.0;
    
    // Moving highlight bar
    const shimmerX = `${position.x} + (${position.width} + ${shimmerWidth}) * (t * ${animationSpeed} - floor(t * ${animationSpeed})) - ${shimmerWidth}`;
    
    return `drawbox=x=${shimmerX}:y=${position.y}:w=${shimmerWidth}:h=${position.height}:color=white@0.3:t=fill`;
  }

  /**
   * Calculate glass panel and text positions
   * @private
   */
  _calculateGlassPosition(style) {
    // Calculate text dimensions (approximate)
    const textWidth = style.text.length * style.fontSize * 0.6;
    const textHeight = style.fontSize;
    
    // Calculate panel dimensions
    const panelWidth = textWidth + (style.padding * 2);
    const panelHeight = textHeight + (style.padding * 2);
    
    // Calculate positions based on alignment
    const positions = {
      'top-left': { 
        x: style.offsetX, 
        y: style.offsetY 
      },
      'top-right': { 
        x: `w-${panelWidth}-${style.offsetX}`, 
        y: style.offsetY 
      },
      'bottom-left': { 
        x: style.offsetX, 
        y: `h-${panelHeight}-${style.offsetY}` 
      },
      'bottom-right': { 
        x: `w-${panelWidth}-${style.offsetX}`, 
        y: `h-${panelHeight}-${style.offsetY}` 
      },
      'center': { 
        x: `(w-${panelWidth})/2`, 
        y: `(h-${panelHeight})/2` 
      },
      'top-center': { 
        x: `(w-${panelWidth})/2`, 
        y: style.offsetY 
      },
      'bottom-center': { 
        x: `(w-${panelWidth})/2`, 
        y: `h-${panelHeight}-${style.offsetY}` 
      }
    };

    const pos = positions[style.position] || positions['center'];
    
    return {
      x: pos.x,
      y: pos.y,
      width: panelWidth,
      height: panelHeight,
      textX: `${pos.x}+${style.padding}`,
      textY: `${pos.y}+${style.padding}`
    };
  }

  /**
   * Apply frosted glass effect with blur
   */
  async applyFrostedGlass(inputPath, outputPath, customStyle = {}) {
    const style = { 
      ...this.defaultStyle, 
      ...customStyle,
      blurIntensity: 20,
      opacity: 0.2,
      gradientOverlay: true
    };
    
    const position = this._calculateGlassPosition(style);
    
    const frostedFilter = [
      '[0:v]split=3[main][blur1][blur2]',
      `[blur1]crop=${position.width}:${position.height}:${position.x}:${position.y},gblur=sigma=${style.blurIntensity}[bg_blur]`,
      `[main]drawbox=x=${position.x}:y=${position.y}:w=${position.width}:h=${position.height}:color=white@${style.opacity}:t=fill[glass_panel]`,
      `[glass_panel]drawbox=x=${position.x}:y=${position.y}:w=${position.width}:h=${position.height/4}:color=white@${style.opacity * 0.6}:t=fill[glass_highlight]`,
      `[glass_highlight]${this._createGlassText(style, position)}[final]`
    ].join(';');

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(frostedFilter)
        .outputOptions(['-c:v libx264', '-c:a copy', '-preset medium', '-crf 18'])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  /**
   * Get glassmorphism preset styles
   */
  getPresetStyles() {
    return {
      modern: {
        text: 'MODERN',
        glassColor: '#ffffff',
        textColor: '#ffffff',
        opacity: 0.15,
        textOpacity: 0.95,
        blurIntensity: 15,
        borderRadius: 25,
        gradientOverlay: true,
        position: 'bottom-right'
      },
      
      minimal: {
        text: 'MINIMAL',
        glassColor: '#000000',
        textColor: '#ffffff',
        opacity: 0.1,
        textOpacity: 0.8,
        blurIntensity: 10,
        borderWidth: 0,
        gradientOverlay: false,
        position: 'center'
      },
      
      colorful: {
        text: 'COLORFUL',
        glassColor: '#ff6b9d',
        textColor: '#ffffff',
        opacity: 0.2,
        textOpacity: 1.0,
        blurIntensity: 12,
        gradientOverlay: true,
        shimmerEffect: true,
        position: 'top-center'
      },
      
      premium: {
        text: 'PREMIUM',
        glassColor: '#ffd700',
        textColor: '#ffffff',
        opacity: 0.12,
        textOpacity: 0.9,
        blurIntensity: 18,
        borderWidth: 2,
        borderOpacity: 0.4,
        gradientOverlay: true,
        position: 'bottom-center'
      },
      
      subtle: {
        text: 'SUBTLE',
        glassColor: '#ffffff',
        textColor: '#000000',
        opacity: 0.05,
        textOpacity: 0.7,
        blurIntensity: 8,
        borderWidth: 1,
        borderOpacity: 0.1,
        gradientOverlay: false,
        position: 'top-left'
      }
    };
  }

  /**
   * Create breathing glass effect
   */
  async createBreathingGlass(inputPath, outputPath, customStyle = {}) {
    const style = { 
      ...this.defaultStyle, 
      ...customStyle,
      pulseEffect: true 
    };
    
    const position = this._calculateGlassPosition(style);
    
    // Pulsing opacity and size
    const pulseOpacity = `${style.opacity} * (0.8 + 0.2 * sin(t * 2))`;
    const pulseSize = `${style.fontSize} * (0.95 + 0.05 * sin(t * 1.5))`;
    
    const breathingFilter = [
      `drawbox=x=${position.x}:y=${position.y}:w=${position.width}:h=${position.height}:color=${style.glassColor}@${pulseOpacity}:t=fill`,
      `drawtext=text='${style.text}':fontsize=${pulseSize}:fontcolor=${style.textColor}@${style.textOpacity}:x=${position.textX}:y=${position.textY}:font='${style.font}'`
    ].join(',');

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(breathingFilter)
        .outputOptions(['-c:v libx264', '-c:a copy', '-preset medium', '-crf 20'])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }
}

module.exports = GlassMorphismWatermarkStyler;