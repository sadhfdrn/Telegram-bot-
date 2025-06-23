const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

class NeonWatermarkStyler {
  constructor() {
    // Cyberpunk/neon style configuration
    this.defaultStyle = {
      text: 'NEON',
      font: 'Arial Bold',
      fontSize: 52,
      primaryColor: '#00ffff', // Cyan
      secondaryColor: '#ff00ff', // Magenta
      glowColor: '#00ffff',
      opacity: 0.85,
      rotation: 0,
      position: 'top-right',
      offsetX: 40,
      offsetY: 40,
      glowIntensity: 8,
      enableDoubleStroke: true,
      strokeWidth: 3,
      animationSpeed: 0.5,
      blinkEffect: false,
      scanlineEffect: true
    };
  }

  /**
   * Apply neon watermark to video with animated effects
   */
  applyToVideo(inputPath, outputPath, customStyle = {}) {
    const style = { ...this.defaultStyle, ...customStyle };
    const complexFilter = this._buildNeonFilter(style);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(complexFilter)
        .outputOptions([
          '-c:v libx264',
          '-c:a copy',
          '-preset medium',
          '-crf 20',
          '-pix_fmt yuv420p'
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('Neon effect processing started:', commandLine);
        })
        .on('progress', (progress) => {
          console.log(`Neon processing: ${progress.percent}% done`);
        })
        .on('end', () => {
          console.log('Neon watermark applied successfully!');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('Neon processing error:', err.message);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Apply neon watermark to image
   */
  applyToImage(inputPath, outputPath, customStyle = {}) {
    const style = { ...this.defaultStyle, ...customStyle };
    const filter = this._buildStaticNeonFilter(style);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(filter)
        .outputOptions(['-q:v 1'])
        .output(outputPath)
        .on('end', () => {
          console.log('Neon watermark applied to image!');
          resolve(outputPath);
        })
        .on('error', reject)
        .run();
    });
  }

  /**
   * Build complex neon filter for videos with animation
   * @private
   */
  _buildNeonFilter(style) {
    const position = this._calculatePosition(style.position, style.offsetX, style.offsetY);
    
    // Create multiple text layers for neon glow effect
    const layers = [];
    
    // Base glow layer (largest, most transparent)
    layers.push(`drawtext=text='${style.text}':fontsize=${style.fontSize + style.glowIntensity * 2}:fontcolor=${style.glowColor}@0.2:x=${position.x}:y=${position.y}:font='${style.font}'`);
    
    // Medium glow layer
    layers.push(`drawtext=text='${style.text}':fontsize=${style.fontSize + style.glowIntensity}:fontcolor=${style.glowColor}@0.4:x=${position.x}:y=${position.y}:font='${style.font}'`);
    
    // Inner glow layer
    layers.push(`drawtext=text='${style.text}':fontsize=${style.fontSize + 2}:fontcolor=${style.glowColor}@0.6:x=${position.x}:y=${position.y}:font='${style.font}'`);
    
    // Main text layer with dual colors
    if (style.enableDoubleStroke) {
      layers.push(`drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.primaryColor}@${style.opacity}:x=${position.x}:y=${position.y}:font='${style.font}':borderw=${style.strokeWidth}:bordercolor=${style.secondaryColor}`);
    } else {
      layers.push(`drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.primaryColor}@${style.opacity}:x=${position.x}:y=${position.y}:font='${style.font}'`);
    }

    // Add blinking effect if enabled
    if (style.blinkEffect) {
      const blinkModulation = `if(mod(floor(t*${style.animationSpeed*2}),2),${style.opacity},${style.opacity*0.3})`;
      layers[layers.length - 1] = layers[layers.length - 1].replace(`@${style.opacity}`, `@${blinkModulation}`);
    }

    return layers.join(',');
  }

  /**
   * Build static neon filter for images
   * @private
   */
  _buildStaticNeonFilter(style) {
    const position = this._calculatePosition(style.position, style.offsetX, style.offsetY);
    
    // Multiple overlapping text layers for glow effect
    let filter = `drawtext=text='${style.text}':fontsize=${style.fontSize + style.glowIntensity * 2}:fontcolor=${style.glowColor}@0.15:x=${position.x}:y=${position.y}:font='${style.font}',`;
    filter += `drawtext=text='${style.text}':fontsize=${style.fontSize + style.glowIntensity}:fontcolor=${style.glowColor}@0.3:x=${position.x}:y=${position.y}:font='${style.font}',`;
    filter += `drawtext=text='${style.text}':fontsize=${style.fontSize + 2}:fontcolor=${style.glowColor}@0.5:x=${position.x}:y=${position.y}:font='${style.font}',`;
    filter += `drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.primaryColor}@${style.opacity}:x=${position.x}:y=${position.y}:font='${style.font}':borderw=${style.strokeWidth}:bordercolor=${style.secondaryColor}`;
    
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
    return positions[position] || positions['top-right'];
  }

  /**
   * Apply pulsing neon effect (advanced)
   */
  async applyPulsingNeon(inputPath, outputPath, customStyle = {}) {
    const style = { 
      ...this.defaultStyle, 
      ...customStyle,
      animationSpeed: 1.5,
      blinkEffect: false 
    };
    
    const position = this._calculatePosition(style.position, style.offsetX, style.offsetY);
    
    // Create pulsing glow effect using mathematical expressions
    const pulseExpression = `${style.opacity}*(0.7+0.3*sin(t*${style.animationSpeed*3}))`;
    const glowExpression = `0.4*(0.5+0.5*sin(t*${style.animationSpeed*2}))`;
    
    const complexFilter = [
      `drawtext=text='${style.text}':fontsize=${style.fontSize + style.glowIntensity * 3}:fontcolor=${style.glowColor}@${glowExpression}:x=${position.x}:y=${position.y}:font='${style.font}'`,
      `drawtext=text='${style.text}':fontsize=${style.fontSize + style.glowIntensity}:fontcolor=${style.glowColor}@${glowExpression}:x=${position.x}:y=${position.y}:font='${style.font}'`,
      `drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.primaryColor}@${pulseExpression}:x=${position.x}:y=${position.y}:font='${style.font}':borderw=${style.strokeWidth}:bordercolor=${style.secondaryColor}`
    ].join(',');

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(complexFilter)
        .outputOptions(['-c:v libx264', '-c:a copy', '-preset medium', '-crf 18'])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  /**
   * Get neon preset styles
   */
  getPresetStyles() {
    return {
      cyberpunk: {
        text: 'CYBER',
        primaryColor: '#00ffff',
        secondaryColor: '#ff00ff',
        glowColor: '#00ffff',
        fontSize: 48,
        glowIntensity: 10,
        blinkEffect: true,
        position: 'center'
      },
      
      retro: {
        text: 'RETRO',
        primaryColor: '#ff6b9d',
        secondaryColor: '#4ecdc4',
        glowColor: '#ff6b9d',
        fontSize: 56,
        glowIntensity: 6,
        position: 'top-center'
      },
      
      electric: {
        text: 'ELECTRIC',
        primaryColor: '#ffff00',
        secondaryColor: '#0000ff',
        glowColor: '#ffffff',
        fontSize: 44,
        glowIntensity: 12,
        animationSpeed: 2.0,
        position: 'bottom-right'
      },
      
      minimal: {
        text: 'MINIMAL',
        primaryColor: '#ffffff',
        secondaryColor: '#00ffff',
        glowColor: '#00ffff',
        fontSize: 36,
        glowIntensity: 4,
        opacity: 0.7,
        position: 'bottom-left'
      },
      
      synthwave: {
        text: 'SYNTHWAVE',
        primaryColor: '#ff007f',
        secondaryColor: '#00d4ff',
        glowColor: '#ff007f',
        fontSize: 40,
        glowIntensity: 8,
        blinkEffect: false,
        position: 'top-right'
      }
    };
  }

  /**
   * Create animated logo reveal effect
   */
  async createLogoReveal(inputPath, outputPath, customStyle = {}) {
    const style = { ...this.defaultStyle, ...customStyle };
    const position = this._calculatePosition(style.position, style.offsetX, style.offsetY);
    
    // Animated text that fades in with growing glow
    const revealFilter = [
      `drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.primaryColor}@min(t*0.5,${style.opacity}):x=${position.x}:y=${position.y}:font='${style.font}'`,
      `drawtext=text='${style.text}':fontsize=${style.fontSize + Math.min(20, style.glowIntensity * 2)}:fontcolor=${style.glowColor}@min(t*0.3,0.4):x=${position.x}:y=${position.y}:font='${style.font}'`
    ].join(',');

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(revealFilter)
        .outputOptions(['-c:v libx264', '-c:a copy', '-preset medium', '-crf 20'])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }
}

module.exports = NeonWatermarkStyler;

// Usage Examples:
/*
const NeonWatermarkStyler = require('./neon.js');
const neon = new NeonWatermarkStyler();

// Basic neon effect
neon.applyToVideo('input.mp4', 'neon_output.mp4');

// Custom cyberpunk style
const cyberpunkStyle = {
  text: 'DIGITAL DREAMS',
  primaryColor: '#00ff41',
  secondaryColor: '#ff0080',
  fontSize: 64,
  glowIntensity: 15,
  blinkEffect: true
};

neon.applyToVideo('input.mp4', 'cyberpunk.mp4', cyberpunkStyle);

// Pulsing animation
neon.applyPulsingNeon('input.mp4', 'pulsing.mp4');

// Use presets
const presets = neon.getPresetStyles();
neon.applyToVideo('input.mp4', 'synthwave.mp4', presets.synthwave);
*/