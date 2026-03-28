import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

export type DeploymentMode = 'prod' | 'test' | 'dev';
export type VisualTheme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private _mode: DeploymentMode = 'prod';
  private _visualTheme: VisualTheme = 'light';

  constructor() { }

  get mode(): DeploymentMode {
    return this._mode;
  }

  get visualTheme(): VisualTheme {
    return this._visualTheme;
  }

  get isTest(): boolean {
    return this._mode === 'test';
  }

  get isDev(): boolean {
    return this._mode === 'dev';
  }

  get isProd(): boolean {
    return this._mode === 'prod';
  }

  setVisualTheme(theme: VisualTheme): void {
    this._visualTheme = theme;
    this.applyVisualTheme();
    localStorage.setItem('user-visual-theme', theme);
  }

  init(): void {
    this.detectMode();
    this.detectVisualTheme();
    this.applyTheme();
    this.applyVisualTheme();
  }

  private detectVisualTheme(): void {
    const savedTheme = localStorage.getItem('user-visual-theme') as VisualTheme;
    if (savedTheme && ['light', 'dark'].includes(savedTheme)) {
      this._visualTheme = savedTheme;
    } else {
      // Default for first-time users is always light mode.
      this._visualTheme = 'light';
      localStorage.setItem('user-visual-theme', this._visualTheme);
    }
  }

  private detectMode(): void {
    // 1. Production (Highest Priority) - explicit build config
    if (environment.deploymentMode === 'prod') {
      this._mode = 'prod';
      return;
    }

    // 2. Test - explicit build config
    if (environment.deploymentMode === 'test') {
      this._mode = 'test';
      return;
    }

    // 3. Dev - explicit build config
    if (environment.deploymentMode === 'dev') {
        this._mode = 'dev';
        return;
    }

    // 4. Runtime Fallback Detection
    if (this.isRuntimeTest()) {
      this._mode = 'test';
    } else if (this.isRuntimeDev()) {
      this._mode = 'dev';
    } else {
        // Default fall back
        this._mode = 'dev';
    }
  }

  private isRuntimeTest(): boolean {
    // Example: hostname contains test, tst, uat, etc.
    return /(^test\.|\.test\.|tst|uat|stg)/i.test(location.hostname) || location.pathname.startsWith('/test');
  }

  private isRuntimeDev(): boolean {
      // Localhost or typical dev ports
      return location.hostname === 'localhost' || 
             location.hostname === '127.0.0.1' || 
             location.port === '4200' || 
             location.port === '5000';
  }


  private applyTheme(): void {
    const mode = this._mode;
    
    // 1. Set data attributes on html
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-env', mode);

    // 2. Update document title
    const baseTitle = 'Connect';
    let suffix = '';
    
    if (mode === 'dev') suffix = ' (DEV)';
    else if (mode === 'test') suffix = ' (TEST)';
    
    // Check if suffix needs to be applied
    if (!document.title.includes(suffix) && suffix) {
       document.title = baseTitle + suffix;
    } else if (mode === 'prod') {
        // Ensure clean title in prod
        document.title = baseTitle;
    }


    // 3. Update favicon
    const favLink = document.getElementById('app-favicon') as HTMLLinkElement;
    if (favLink) {
      let faviconPath = 'assets/brand/favicon.ico'; // default prod
      if (mode === 'dev') faviconPath = 'assets/brand/favicon-dev.ico';
      else if (mode === 'test') faviconPath = 'assets/brand/favicon-test.ico';

      favLink.href = faviconPath;
    }
    
    // 4. Update Theme CSS (Link Swapping)
    const themeLink = document.getElementById('app-theme') as HTMLLinkElement;
    if (themeLink) {
        let themePath = 'assets/themes/prod-theme.css';
        if (mode === 'dev') themePath = 'assets/themes/dev-theme.css';
        else if (mode === 'test') themePath = 'assets/themes/test-theme.css';
        
        themeLink.href = themePath;
    }
  }

  private applyVisualTheme(): void {
    const theme = this._visualTheme;
    document.documentElement.setAttribute('data-visual-theme', theme);
    
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    }
  }
}
