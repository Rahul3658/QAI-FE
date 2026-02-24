/**
 * ThemeAwareStyles - Manages theme-specific styling with WCAG compliance
 * 
 * Provides color definitions and contrast validation for light and dark themes
 */

class ThemeAwareStyles {
  constructor() {
    // Light mode colors
    this.lightMode = {
      userMessage: {
        text: '#1a1a1a',
        background: '#f0f0f0'
      },
      assistantMessage: {
        text: '#2c3e50',
        background: '#ffffff'
      },
      error: {
        text: '#c0392b',
        background: 'rgba(220, 53, 69, 0.1)'
      },
      status: {
        listening: '#f5576c',
        processing: '#00f2fe',
        speaking: '#38f9d7',
        idle: '#764ba2'
      }
    };

    // Dark mode colors
    this.darkMode = {
      userMessage: {
        text: '#e0e0e0',
        background: '#2a2a2a'
      },
      assistantMessage: {
        text: '#ecf0f1',
        background: '#1a1a1a'
      },
      error: {
        text: '#e74c3c',
        background: 'rgba(231, 76, 60, 0.15)'
      },
      status: {
        listening: '#f093fb',
        processing: '#4facfe',
        speaking: '#43e97b',
        idle: '#667eea'
      }
    };
  }

  /**
   * Get text color for current theme
   * @param {string} theme - 'light' or 'dark'
   * @param {string} messageType - 'user', 'assistant', or 'error'
   * @returns {string} CSS color value
   */
  getTextColor(theme, messageType = 'assistant') {
    const colors = theme === 'dark' ? this.darkMode : this.lightMode;
    
    switch (messageType) {
      case 'user':
        return colors.userMessage.text;
      case 'error':
        return colors.error.text;
      case 'assistant':
      default:
        return colors.assistantMessage.text;
    }
  }

  /**
   * Get background color for current theme
   * @param {string} theme - 'light' or 'dark'
   * @param {string} messageType - 'user', 'assistant', or 'error'
   * @returns {string} CSS color value
   */
  getBackgroundColor(theme, messageType = 'assistant') {
    const colors = theme === 'dark' ? this.darkMode : this.lightMode;
    
    switch (messageType) {
      case 'user':
        return colors.userMessage.background;
      case 'error':
        return colors.error.background;
      case 'assistant':
      default:
        return colors.assistantMessage.background;
    }
  }

  /**
   * Get status indicator color
   * @param {string} status - Status type (listening, processing, speaking, idle)
   * @param {string} theme - 'light' or 'dark'
   * @returns {string} CSS color value
   */
  getStatusColor(status, theme = 'light') {
    const colors = theme === 'dark' ? this.darkMode : this.lightMode;
    return colors.status[status] || colors.status.idle;
  }

  /**
   * Validate WCAG AA contrast compliance
   * @param {string} foreground - Foreground color (hex or rgb)
   * @param {string} background - Background color (hex or rgb)
   * @returns {boolean} True if compliant
   */
  validateContrast(foreground, background) {
    const fgLuminance = this._calculateLuminance(foreground);
    const bgLuminance = this._calculateLuminance(background);
    
    const ratio = this._calculateContrastRatio(fgLuminance, bgLuminance);
    
    // WCAG AA requires 4.5:1 for normal text
    return ratio >= 4.5;
  }

  /**
   * Calculate relative luminance
   * @private
   * @param {string} color - Color value
   * @returns {number} Relative luminance
   */
  _calculateLuminance(color) {
    const rgb = this._parseColor(color);
    
    const [r, g, b] = rgb.map(val => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Calculate contrast ratio
   * @private
   * @param {number} lum1 - Luminance 1
   * @param {number} lum2 - Luminance 2
   * @returns {number} Contrast ratio
   */
  _calculateContrastRatio(lum1, lum2) {
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Parse color string to RGB array
   * @private
   * @param {string} color - Color value (hex or rgb)
   * @returns {Array<number>} RGB values [r, g, b]
   */
  _parseColor(color) {
    // Handle hex colors
    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      if (hex.length === 3) {
        return [
          parseInt(hex[0] + hex[0], 16),
          parseInt(hex[1] + hex[1], 16),
          parseInt(hex[2] + hex[2], 16)
        ];
      }
      return [
        parseInt(hex.substr(0, 2), 16),
        parseInt(hex.substr(2, 2), 16),
        parseInt(hex.substr(4, 2), 16)
      ];
    }
    
    // Handle rgb/rgba colors
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      return [
        parseInt(match[1], 10),
        parseInt(match[2], 10),
        parseInt(match[3], 10)
      ];
    }
    
    // Default to black
    return [0, 0, 0];
  }

  /**
   * Get all message styles for a theme
   * @param {string} theme - 'light' or 'dark'
   * @param {string} messageType - 'user', 'assistant', or 'error'
   * @returns {Object} Style object
   */
  getMessageStyles(theme, messageType = 'assistant') {
    return {
      color: this.getTextColor(theme, messageType),
      backgroundColor: this.getBackgroundColor(theme, messageType)
    };
  }

  /**
   * Detect current theme from document
   * @returns {string} 'light' or 'dark'
   */
  detectTheme() {
    // Check for dark mode class on body or html
    if (document.body.classList.contains('dark-mode') || 
        document.documentElement.classList.contains('dark-mode')) {
      return 'dark';
    }
    
    // Check for prefers-color-scheme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    
    return 'light';
  }
}

// Export singleton instance
const themeAwareStyles = new ThemeAwareStyles();
export default themeAwareStyles;
