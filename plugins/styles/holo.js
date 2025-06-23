const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

class HolographicWatermarkStyler {
  constructor() {
    // Futuristic holographic style configuration
    this.defaultStyle = {
      text: 'HOLOGRAM',
      font: 'Arial Bold',
      fontSize: 50,
      primaryColor: '#00ffff', // Cyan
      secondaryColor: '#ff00ff', // Magenta
      tertiaryColor: '#ffff00', // Yellow
      accentColor: '#00ff00', // Green
      opacity: 0.8,
      rotation: 0,
      position: 'center',
      offsetX: 0,
      offsetY: 0,
      scanlineSpeed: 2.0,
      glitchIntensity: 0.3,
      chromaticAberration: 3,
      enableScanlines: true,
      enableGlitch: true,
      enableRainbow: true,
      enableFlicker: false,
      hologramDepth: 5,
      interferencePattern: true,
      prismEffect: true
    };
  }

  /**
   * Apply holographic watermark to video with animated effects
   */
  applyToVideo(inputPath, outputPath, customStyle = {}) {
    const style = { ...this.defaultStyle, ...customStyle };
    const complexFilter = this._buildHolographicFilter(style);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(complexFilter)
        .outputOptions([
          '-c:v libx264',
          '-c:a copy',
          '-preset medium',
          '-crf 18',
          '-pix_fmt yuv420p'
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('Holographic processing started:', commandLine);
        })
        .on('progress', (progress) => {
          console.log(`Holographic processing: ${progress.percent}% done`);
        })
        .on('end', () => {
          console.log('Holographic watermark applied successfully!');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('Holographic processing error:', err.message);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Apply holographic watermark to image
   */
  applyToImage(inputPath, outputPath, customStyle = {}) {
    const style = { ...this.defaultStyle, ...customStyle };
    const filter = this._buildStaticHolographicFilter(style);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(filter)
        .outputOptions(['-q:v 1'])
        .output(outputPath)
        .on('end', () => {
          console.log('Holographic watermark applied to image!');
          resolve(outputPath);
        })
        .on('error', reject)
        .run();
    });
  }

  /**
   * Build complex holographic filter with multiple layers and effects
   * @private
   */
  _buildHolographicFilter(style) {
    const position = this._calculatePosition(style.position, style.offsetX, style.offsetY);
    const layers = [];

    // Create rainbow shifting effect
    if (style.enableRainbow) {
      const rainbowColors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];
      rainbowColors.forEach((color, index) => {
        const phase = index * 0.5;
        const colorOpacity = `${style.opacity * 0.6}*abs(sin(t*${style.scanlineSpeed}+${phase}))`;
        layers.push(`drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${color}@${colorOpacity}:x=${position.x}+${index}:y=${position.y}+${index}:font='${style.font}'`);
      });
    }

    // Chromatic aberration layers (RGB separation)
    if (style.chromaticAberration > 0) {
      const offset = style.chromaticAberration;
      layers.push(`drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=#ff0000@${style.opacity * 0.7}:x=${position.x}-${offset}:y=${position.y}:font='${style.font}'`);
      layers.push(`drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=#00ff00@${style.opacity * 0.7}:x=${position.x}:y=${position.y}:font='${style.font}'`);
      layers.push(`drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=#0000ff@${style.opacity * 0.7}:x=${position.x}+${offset}:y=${position.y}:font='${style.font}'`);
    }

    // Interference pattern (creates holographic texture)
    if (style.interferencePattern) {
      const patternOpacity = `${style.opacity * 0.4}*abs(sin(t*${style.scanlineSpeed*3}))`;
      layers.push(`drawtext=text='${style.text}':fontsize=${style.fontSize + 2}:fontcolor=${style.primaryColor}@${patternOpacity}:x=${position.x}:y=${position.y}:font='${style.font}'`);
    }

    // Glitch effect with random displacement
    if (style.enableGlitch) {
      const glitchX = `${position.x}+${style.glitchIntensity*10}*sin(t*${style.scanlineSpeed*5})`;
      const glitchY = `${position.y}+${style.glitchIntensity*5}*cos(t*${style.scanlineSpeed*7})`;
      const glitchOpacity = `${style.opacity}*if(mod(floor(t*${style.scanlineSpeed*4}),8),1,0.3)`;
      layers.push(`drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.secondaryColor}@${glitchOpacity}:x=${glitchX}:y=${glitchY}:font='${style.font}'`);
    }

    // Main holographic text with prismatic effect
    if (style.prismEffect) {
      const prismColors = [style.primaryColor, style.secondaryColor, style.tertiaryColor, style.accentColor];
      prismColors.forEach((color, index) => {
        const prismOffset = index * 2;
        const prismOpacity = `${style.opacity * 0.8}*abs(sin(t*${style.scanlineSpeed}+${index}))`;
        layers.push(`drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${color}@${prismOpacity}:x=${position.x}+${prismOffset}:y=${position.y}+${prismOffset}:font='${style.font}'`);
      });
    }

    // Flickering effect
    if (style.enableFlicker) {
      const flickerOpacity = `${style.opacity}*if(mod(floor(t*${style.scanlineSpeed*8}),3),1,0.1)`;
      layers.push(`drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.primaryColor}@${flickerOpacity}:x=${position.x}:y=${position.y}:font='${style.font}'`);
    }

    return layers.join(',');
  }

  /**
   * Build static holographic filter for images
   * @private
   */
  _buildStaticHolographicFilter(style) {
    const position = this._calculatePosition(style.position, style.offsetX, style.offsetY);
    const filters = [];

    // Rainbow layers
    if (style.enableRainbow) {
      const rainbowColors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];
      rainbowColors.forEach((color, index) => {
        filters.push(`drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${color}@${style.opacity * 0.4}:x=${position.x}+${index}:y=${position.y}+${index}:font='${style.font}'`);
      });
    }

    // Chromatic aberration
    if (style.chromaticAberration > 0) {
      const offset = style.chromaticAberration;
      filters.push(`drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=#ff0000@${style.opacity * 0.6}:x=${position.x}-${offset}:y=${position.y}:font='${style.font}'`);
      filters.push(`drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=#00ff00@${style.opacity * 0.6}:x=${position.x}:y=${position.y}:font='${style.font}'`);
      filters.push(`drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=#0000ff@${style.opacity * 0.6}:x=${position.x}+${offset}:y=${position.y}:font='${style.font}'`);
    }

    // Main prismatic layers
    if (style.prismEffect) {
      const prismColors = [style.primaryColor, style.secondaryColor, style.tertiaryColor];
      prismColors.forEach((color, index) => {
        filters.push(`drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${color}@${style.opacity * 0.7}:x=${position.x}+${index * 2}:y=${position.y}+${index * 2}:font='${style.font}'`);
      });
    }

    return filters.join(',');
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
    return positions[position] || positions['center'];
  }

  /**
   * Create matrix-style digital rain effect
   */
  async applyMatrixEffect(inputPath, outputPath, customStyle = {}) {
    const style = { 
      ...this.defaultStyle, 
      ...customStyle,
      enableRainbow: false,
      primaryColor: '#00ff00',
      secondaryColor: '#00aa00',
      enableGlitch: true,
      glitchIntensity: 0.5
    };
    
    const position = this._calculatePosition(style.position, style.offsetX, style.offsetY);
    
    // Create matrix-like streaming effect
    const matrixFilter = [
      `drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.primaryColor}@${style.opacity}*abs(sin(t*3)):x=${position.x}:y=${position.y}:font='${style.font}'`,
      `drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.secondaryColor}@${style.opacity*0.7}*abs(cos(t*2)):x=${position.x}+2:y=${position.y}+2:font='${style.font}'`,
      `drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.primaryColor}@${style.opacity*0.5}*abs(sin(t*4)):x=${position.x}-1:y=${position.y}-1:font='${style.font}'`
    ].join(',');

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(matrixFilter)
        .outputOptions(['-c:v libx264', '-c:a copy', '-preset medium', '-crf 20])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  /**
   * Create quantum flux effect
   */
  async applyQuantumFlux(inputPath, outputPath, customStyle = {}) {
    const style = { 
      ...this.defaultStyle, 
      ...customStyle,
      scanlineSpeed: 1.5,
      chromaticAberration: 5,
      enableRainbow: true,
      prismEffect: true
    };
    
    const position = this._calculatePosition(style.position, style.offsetX, style.offsetY);
    
    // Create quantum interference patterns
    const quantumFilter = [
      // Phase 1: Matter
      `drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.primaryColor}@${style.opacity}*abs(sin(t*2)):x=${position.x}:y=${position.y}:font='${style.font}'`,
      // Phase 2: Antimatter
      `drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.secondaryColor}@${style.opacity}*abs(sin(t*2+PI)):x=${position.x}+3:y=${position.y}:font='${style.font}'`,
      // Phase 3: Energy flux
      `drawtext=text='${style.text}':fontsize=${style.fontSize + 4}:fontcolor=${style.tertiaryColor}@${style.opacity*0.3}*abs(sin(t*4)):x=${position.x}:y=${position.y}:font='${style.font}'`,
      // Phase 4: Quantum tunneling
      `drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.accentColor}@${style.opacity*0.6}*if(mod(floor(t*3),4),1,0):x=${position.x}-2:y=${position.y}+1:font='${style.font}'`
    ].join(',');

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(quantumFilter)
        .outputOptions(['-c:v libx264', '-c:a copy', '-preset medium', '-crf 18])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  /**
   * Get holographic preset styles
   */
  getPresetStyles() {
    return {
      cyberpunk: {
        text: 'CYBERPUNK',
        primaryColor: '#00ffff',
        secondaryColor: '#ff00ff',
        tertiaryColor: '#ffff00',
        enableRainbow: true,
        chromaticAberration: 4,
        scanlineSpeed: 2.5,
        position: 'center'
      },
      
      matrix: {
        text: 'MATRIX',
        primaryColor: '#00ff00',
        secondaryColor: '#00aa00',
        tertiaryColor: '#008800',
        enableRainbow: false,
        enableGlitch: true,
        glitchIntensity: 0.4,
        position: 'top-left'
      },
      
      quantum: {
        text: 'QUANTUM',
        primaryColor: '#4169e1',
        secondaryColor: '#ff1493',
        tertiaryColor: '#00ced1',
        accentColor: '#ffd700',
        chromaticAberration: 6,
        interferencePattern: true,
        position: 'bottom-right'
      },
      
      spectrum: {
        text: 'SPECTRUM',
        primaryColor: '#ff0080',
        secondaryColor: '#0080ff',
        tertiaryColor: '#80ff00',
        accentColor: '#ff8000',
        enableRainbow: true,
        prismEffect: true,
        scanlineSpeed: 3.0,
        position: 'center'
      },
      
      glitch: {
        text: 'GLITCH',
        primaryColor: '#ff0040',
        secondaryColor: '#00ff80',
        tertiaryColor: '#8000ff',
        enableGlitch: true,
        enableFlicker: true,
        glitchIntensity: 0.6,
        chromaticAberration: 8,
        position: 'top-right'
      },
      
      holodeck: {
        text: 'HOLODECK',
        primaryColor: '#ffd700',
        secondaryColor: '#ff6347',
        tertiaryColor: '#00bfff',
        accentColor: '#98fb98',
        interferencePattern: true,
        prismEffect: true,
        scanlineSpeed: 1.8,
        position: 'bottom-center'
      }
    };
  }
}

module.exports = HolographicWatermarkStyler;

// Usage Examples:
/*
const HolographicWatermarkStyler = require('./holographic.js');
const holo = new HolographicWatermarkStyler();

// Basic holographic effect
holo.applyToVideo('input.mp4', 'holo_output.mp4');

// Matrix-style effect
holo.applyMatrixEffect('input.mp4', 'matrix.mp4');

// Quantum flux effect
holo.applyQuantumFlux('input.mp4', 'quantum.mp4');

// Use presets
const presets = holo.getPresetStyles();
holo.applyToVideo('input.mp4', 'cyberpunk.mp4', presets.cyberpunk);
*/