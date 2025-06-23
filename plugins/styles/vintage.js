const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

class VintageWatermarkStyler {
  constructor() {
    // Classic vintage/retro style configuration
    this.defaultStyle = {
      text: 'VINTAGE',
      font: 'Times New Roman Bold',
      fontSize: 48,
      primaryColor: '#d4af37', // Antique gold
      shadowColor: '#8b4513', // Saddle brown
      patina: '#2f4f2f', // Dark slate gray
      opacity: 0.75,
      rotation: 0,
      position: 'bottom-center',
      offsetX: 0,
      offsetY: 50,
      shadowOffset: 3,
      enablePatina: true,
      enableEmboss: true,
      borderStyle: 'ornate',
      borderWidth: 4,
      ageEffect: 0.3,
      sepia: true,
      noise: 0.15,
      vignette: false
    };
  }

  /**
   * Apply vintage watermark to video
   */
  applyToVideo(inputPath, outputPath, customStyle = {}) {
    const style = { ...this.defaultStyle, ...customStyle };
    const complexFilter = this._buildVintageFilter(style);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(complexFilter)
        .outputOptions([
          '-c:v libx264',
          '-c:a copy',
          '-preset slow',
          '-crf 18',
          '-pix_fmt yuv420p'
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('Vintage processing started:', commandLine);
        })
        .on('progress', (progress) => {
          console.log(`Vintage processing: ${progress.percent}% done`);
        })
        .on('end', () => {
          console.log('Vintage watermark applied successfully!');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('Vintage processing error:', err.message);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Apply vintage watermark to image
   */
  applyToImage(inputPath, outputPath, customStyle = {}) {
    const style = { ...this.defaultStyle, ...customStyle };
    const filter = this._buildStaticVintageFilter(style);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(filter)
        .outputOptions(['-q:v 2'])
        .output(outputPath)
        .on('end', () => {
          console.log('Vintage watermark applied to image!');
          resolve(outputPath);
        })
        .on('error', reject)
        .run();
    });
  }

  /**
   * Build complex vintage filter with aging effects
   * @private
   */
  _buildVintageFilter(style) {
    const position = this._calculatePosition(style.position, style.offsetX, style.offsetY);
    const filters = [];

    // Add sepia tone to base video if enabled
    if (style.sepia) {
      filters.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131');
    }

    // Add film grain/noise
    if (style.noise > 0) {
      filters.push(`noise=alls=${Math.floor(style.noise * 100)}:allf=t+u`);
    }

    // Add vignette effect
    if (style.vignette) {
      filters.push('vignette=PI/4');
    }

    // Create ornate border background if specified
    if (style.borderStyle === 'ornate') {
      const borderFilter = this._createOrnateBorder(style, position);
      filters.push(borderFilter);
    }

    // Create embossed shadow layer
    if (style.enableEmboss) {
      const embossX = parseInt(position.x.toString()) + style.shadowOffset;
      const embossY = parseInt(position.y.toString()) + style.shadowOffset;
      filters.push(`drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.shadowColor}@${style.opacity * 0.6}:x=${embossX}:y=${embossY}:font='${style.font}'`);
    }

    // Create patina/aged layer
    if (style.enablePatina) {
      filters.push(`drawtext=text='${style.text}':fontsize=${style.fontSize + 1}:fontcolor=${style.patina}@${style.ageEffect}:x=${position.x}:y=${position.y}:font='${style.font}'`);
    }

    // Main vintage text with ornate styling
    const mainTextFilter = this._buildMainVintageText(style, position);
    filters.push(mainTextFilter);

    return filters.join(',');
  }

  /**
   * Build static vintage filter for images
   * @private
   */
  _buildStaticVintageFilter(style) {
    const position = this._calculatePosition(style.position, style.offsetX, style.offsetY);
    const filters = [];

    // Sepia effect
    if (style.sepia) {
      filters.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131');
    }

    // Ornate border
    if (style.borderStyle === 'ornate') {
      filters.push(this._createOrnateBorder(style, position));
    }

    // Embossed shadow
    if (style.enableEmboss) {
      filters.push(`drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.shadowColor}@${style.opacity * 0.6}:x=${position.x}+${style.shadowOffset}:y=${position.y}+${style.shadowOffset}:font='${style.font}'`);
    }

    // Patina layer
    if (style.enablePatina) {
      filters.push(`drawtext=text='${style.text}':fontsize=${style.fontSize + 1}:fontcolor=${style.patina}@${style.ageEffect}:x=${position.x}:y=${position.y}:font='${style.font}'`);
    }

    // Main text
    filters.push(this._buildMainVintageText(style, position));

    return filters.join(',');
  }

  /**
   * Create ornate decorative border
   * @private
   */
  _createOrnateBorder(style, position) {
    // Create decorative frame using drawbox and geometric shapes
    const boxWidth = `tw+${style.borderWidth * 8}`;
    const boxHeight = `th+${style.borderWidth * 4}`;
    const boxX = `${position.x}-${style.borderWidth * 4}`;
    const boxY = `${position.y}-${style.borderWidth * 2}`;
    
    return `drawbox=x=${boxX}:y=${boxY}:w=${boxWidth}:h=${boxHeight}:color=${style.patina}@${style.ageEffect}:t=${style.borderWidth}`;
  }

  /**
   * Build main vintage text with ornate styling
   * @private
   */
  _buildMainVintageText(style, position) {
    let textFilter = `drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.primaryColor}@${style.opacity}:x=${position.x}:y=${position.y}:font='${style.font}'`;
    
    // Add border/outline
    if (style.borderWidth > 0) {
      textFilter += `:borderw=${style.borderWidth}:bordercolor=${style.shadowColor}@${style.opacity * 0.8}`;
    }

    return textFilter;
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
    return positions[position] || positions['bottom-center'];
  }

  /**
   * Apply aged film effect with dust and scratches
   */
  async applyAgedFilm(inputPath, outputPath, customStyle = {}) {
    const style = { 
      ...this.defaultStyle, 
      ...customStyle,
      sepia: true,
      noise: 0.25,
      vignette: true,
      ageEffect: 0.4
    };
    
    // Create complex filter with film defects
    const position = this._calculatePosition(style.position, style.offsetX, style.offsetY);
    const filmFilter = [
      // Base sepia and aging
      'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
      'curves=all=0/0.1 0.5/0.4 1/0.9', // Fade contrast
      `noise=alls=${Math.floor(style.noise * 100)}:allf=t+u`,
      'vignette=PI/3',
      
      // Text layers
      `drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.shadowColor}@${style.opacity * 0.6}:x=${position.x}+${style.shadowOffset}:y=${position.y}+${style.shadowOffset}:font='${style.font}'`,
      `drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.primaryColor}@${style.opacity}:x=${position.x}:y=${position.y}:font='${style.font}':borderw=${style.borderWidth}:bordercolor=${style.patina}`
    ].join(',');

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(filmFilter)
        .outputOptions(['-c:v libx264', '-c:a copy', '-preset slow', '-crf 16'])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  /**
   * Create vintage logo stamp effect
   */
  async createStampEffect(inputPath, outputPath, customStyle = {}) {
    const style = { 
      ...this.defaultStyle, 
      ...customStyle,
      borderStyle: 'stamp',
      borderWidth: 8,
      primaryColor: '#8b0000', // Dark red
      patina: '#696969', // Dim gray
      rotation: -5
    };
    
    const position = this._calculatePosition(style.position, style.offsetX, style.offsetY);
    const angle = (style.rotation * Math.PI) / 180;
    
    // Create rubber stamp effect with circular border
    const stampFilter = [
      // Outer circle
      `drawtext=text='◯':fontsize=${style.fontSize * 2}:fontcolor=${style.primaryColor}@0.3:x=${position.x}:y=${position.y}:font='${style.font}':angle=${angle}`,
      // Inner text
      `drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.primaryColor}@${style.opacity}:x=${position.x}:y=${position.y}:font='${style.font}':angle=${angle}:borderw=2:bordercolor=${style.patina}`
    ].join(',');

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(stampFilter)
        .outputOptions(['-c:v libx264', '-c:a copy', '-preset medium', '-crf 20])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  /**
   * Get vintage preset styles
   */
  getPresetStyles() {
    return {
      classic: {
        text: 'CLASSIC',
        primaryColor: '#d4af37',
        shadowColor: '#8b4513',
        patina: '#2f4f2f',
        fontSize: 52,
        sepia: true,
        enableEmboss: true,
        position: 'bottom-center'
      },
      
      antique: {
        text: 'ANTIQUE',
        primaryColor: '#cd853f',
        shadowColor: '#8b4513',
        patina: '#556b2f',
        fontSize: 48,
        borderStyle: 'ornate',
        borderWidth: 6,
        ageEffect: 0.4,
        position: 'center'
      },
      
      oldFilm: {
        text: 'OLD FILM',
        primaryColor: '#f5deb3',
        shadowColor: '#8b7355',
        patina: '#696969',
        fontSize: 44,
        sepia: true,
        noise: 0.2,
        vignette: true,
        position: 'top-left'
      },
      
      rustic: {
        text: 'RUSTIC',
        primaryColor: '#a0522d',
        shadowColor: '#8b4513',
        patina: '#2f4f2f',
        fontSize: 56,
        enablePatina: true,
        ageEffect: 0.5,
        position: 'bottom-right'
      },
      
      elegant: {
        text: 'ELEGANT',
        primaryColor: '#b8860b',
        shadowColor: '#8b7355',
        patina: '#2f2f2f',
        fontSize: 40,
        borderStyle: 'ornate',
        enableEmboss: true,
        position: 'top-center'
      },
      
      stamp: {
        text: 'CERTIFIED',
        primaryColor: '#8b0000',
        shadowColor: '#696969',
        patina: '#2f2f2f',
        fontSize: 36,
        borderStyle: 'stamp',
        rotation: -12,
        position: 'bottom-left'
      }
    };
  }
}

module.exports = VintageWatermarkStyler;

// Usage Examples:
/*
const VintageWatermarkStyler = require('./vintage.js');
const vintage = new VintageWatermarkStyler();

// Basic vintage effect
vintage.applyToVideo('input.mp4', 'vintage_output.mp4');

// Aged film effect
vintage.applyAgedFilm('input.mp4', 'aged_film.mp4');

// Stamp effect
vintage.createStampEffect('input.mp4', 'stamped.mp4', {
  text: 'CONFIDENTIAL',
  rotation: -15
});

// Use presets
const presets = vintage.getPresetStyles();
vintage.applyToVideo('input.mp4', 'antique.mp4', presets.antique);
*/