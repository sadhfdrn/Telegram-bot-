const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

class VintageWatermarkStyler {
  constructor() {
    // Classic film/vintage style configuration
    this.defaultStyle = {
      text: 'VINTAGE',
      font: 'Georgia',
      fontSize: 42,
      primaryColor: '#f4e4c1', // Warm cream
      secondaryColor: '#8b4513', // Saddle brown
      opacity: 0.75,
      rotation: 0,
      position: 'bottom-center',
      offsetX: 0,
      offsetY: 50,
      filmGrain: true,
      sepia: true,
      vignette: true,
      scratches: false,
      borderStyle: 'ornate',
      textureOverlay: true,
      fadeInDuration: 2.0,
      typewriterEffect: false
    };
  }

  /**
   * Apply vintage watermark to video with film effects
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
          '-preset medium',
          '-crf 22',
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
   * Build complex vintage filter for videos
   * @private
   */
  _buildVintageFilter(style) {
    const position = this._calculatePosition(style.position, style.offsetX, style.offsetY);
    const filters = [];

    // Apply sepia tone if enabled
    if (style.sepia) {
      filters.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131');
    }

    // Add film grain
    if (style.filmGrain) {
      filters.push('noise=alls=3:allf=t');
    }

    // Add vignette effect
    if (style.vignette) {
      filters.push('vignette=angle=PI/4:x0=w/2:y0=h/2');
    }

    // Create ornate border if specified
    if (style.borderStyle === 'ornate') {
      filters.push(this._createOrnateBorder());
    }

    // Add typewriter effect or regular text
    if (style.typewriterEffect) {
      const typewriterText = this._createTypewriterEffect(style, position);
      filters.push(typewriterText);
    } else {
      const textFilter = this._createVintageText(style, position);
      filters.push(textFilter);
    }

    return filters.join(',');
  }

  /**
   * Build static vintage filter for images
   * @private
   */
  _buildStaticVintageFilter(style) {
    const position = this._calculatePosition(style.position, style.offsetX, style.offsetY);
    const filters = [];

    if (style.sepia) {
      filters.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131');
    }

    if (style.vignette) {
      filters.push('vignette=angle=PI/4:x0=w/2:y0=h/2');
    }

    const textFilter = this._createVintageText(style, position);
    filters.push(textFilter);

    return filters.join(',');
  }

  /**
   * Create vintage text with decorative elements
   * @private
   */
  _createVintageText(style, position) {
    // Create decorative underline
    const underlineY = `${position.y}+th+5`;
    const decorativeLine = `drawbox=x=${position.x}:y=${underlineY}:w=tw:h=2:color=${style.secondaryColor}@0.6`;
    
    // Main text with shadow and border
    const mainText = `drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.primaryColor}@${style.opacity}:x=${position.x}:y=${position.y}:font='${style.font}':borderw=1:bordercolor=${style.secondaryColor}@0.8:shadowcolor=black@0.5:shadowx=2:shadowy=2`;

    // Add decorative elements (dots)
    const leftDot = `drawtext=text='●':fontsize=${style.fontSize * 0.4}:fontcolor=${style.secondaryColor}@${style.opacity}:x=${position.x}-30:y=${position.y}+${style.fontSize * 0.3}:font='${style.font}'`;
    const rightDot = `drawtext=text='●':fontsize=${style.fontSize * 0.4}:fontcolor=${style.secondaryColor}@${style.opacity}:x=${position.x}+tw+15:y=${position.y}+${style.fontSize * 0.3}:font='${style.font}'`;

    return `${decorativeLine},${mainText},${leftDot},${rightDot}`;
  }

  /**
   * Create typewriter effect
   * @private
   */
  _createTypewriterEffect(style, position) {
    const textLength = style.text.length;
    const revealSpeed = 0.15; // seconds per character
    
    // Use text expansion to simulate typing
    const typewriterText = `drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.primaryColor}@${style.opacity}:x=${position.x}:y=${position.y}:font='${style.font}':borderw=1:bordercolor=${style.secondaryColor}@0.8:expansion=min(t/${revealSpeed}/${textLength},1)`;
    
    return typewriterText;
  }

  /**
   * Create ornate decorative border
   * @private
   */
  _createOrnateBorder() {
    // Create corner decorations
    const cornerSize = 40;
    const borderWidth = 3;
    
    return `drawbox=x=10:y=10:w=${cornerSize}:h=${borderWidth}:color=white@0.7,drawbox=x=10:y=10:w=${borderWidth}:h=${cornerSize}:color=white@0.7,drawbox=x=w-${cornerSize + 10}:y=10:w=${cornerSize}:h=${borderWidth}:color=white@0.7,drawbox=x=w-${borderWidth + 10}:y=10:w=${borderWidth}:h=${cornerSize}:color=white@0.7`;
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
   * Apply aged paper effect
   */
  async applyAgedPaper(inputPath, outputPath, customStyle = {}) {
    const style = { ...this.defaultStyle, ...customStyle };
    const position = this._calculatePosition(style.position, style.offsetX, style.offsetY);
    
    const agedFilter = [
      // Sepia tone
      'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
      // Reduce contrast slightly
      'curves=vintage',
      // Add slight blur for aged effect
      'unsharp=7:7:0.5:7:7:0.0',
      // Add text with aged styling
      `drawtext=text='${style.text}':fontsize=${style.fontSize}:fontcolor=${style.primaryColor}@${style.opacity}:x=${position.x}:y=${position.y}:font='${style.font}':borderw=1:bordercolor=${style.secondaryColor}@0.6`
    ].join(',');

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(agedFilter)
        .outputOptions(['-c:v libx264', '-c:a copy', '-preset medium', '-crf 20'])
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
        primaryColor: '#f4e4c1',
        secondaryColor: '#8b4513',
        fontSize: 48,
        sepia: true,
        vignette: true,
        borderStyle: 'ornate',
        position: 'bottom-center'
      },
      
      silent_film: {
        text: 'SILENT ERA',
        primaryColor: '#ffffff',
        secondaryColor: '#000000',
        fontSize: 52,
        sepia: false,
        filmGrain: true,
        typewriterEffect: true,
        position: 'bottom-center'
      },
      
      golden_age: {
        text: 'GOLDEN AGE',
        primaryColor: '#ffd700',
        secondaryColor: '#8b4513',
        fontSize: 44,
        sepia: true,
        vignette: true,
        borderStyle: 'ornate',
        position: 'top-center'
      },
      
      daguerreotype: {
        text: 'DAGUERREOTYPE',
        primaryColor: '#e6e6fa',
        secondaryColor: '#2f2f2f',
        fontSize: 36,
        sepia: false,
        vignette: true,
        filmGrain: true,
        position: 'bottom-right'
      },
      
      art_deco: {
        text: 'ART DECO',
        primaryColor: '#c9b037',
        secondaryColor: '#000000',
        fontSize: 56,
        sepia: false,
        borderStyle: 'ornate',
        position: 'center'
      }
    };
  }

  /**
   * Create film countdown effect
   */
  async createFilmCountdown(inputPath, outputPath, customStyle = {}) {
    const style = { ...this.defaultStyle, ...customStyle };
    const position = this._calculatePosition('center', 0, 0);
    
    // Create countdown numbers that change every second
    const countdownFilter = [
      'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
      'noise=alls=5:allf=t',
      `drawtext=text=if(lt(mod(t\\,5)\\,1)\\,'5'\\,if(lt(mod(t\\,5)\\,2)\\,'4'\\,if(lt(mod(t\\,5)\\,3)\\,'3'\\,if(lt(mod(t\\,5)\\,4)\\,'2'\\,'1')))):fontsize=120:fontcolor=white@0.9:x=(w-tw)/2:y=(h-th)/2:font=Arial:borderw=3:bordercolor=black`,
      // Add film scratches
      'drawbox=x=iw*random(0):y=0:w=1:h=ih:color=white@0.3:t=1'
    ].join(',');

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(countdownFilter)
        .outputOptions(['-c:v libx264', '-c:a copy', '-preset medium', '-crf 18'])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }
}

module.exports = VintageWatermarkStyler;