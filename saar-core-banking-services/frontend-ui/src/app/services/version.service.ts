/**
 * Version and build information utilities for Angular application
 */

import { environment } from '../environments/environment';

export interface VersionInfo {
  version: string;
  buildTime: string;
  environment: string;
  appName: string;
}

export class VersionService {
  
  static getAppVersion(): string {
    return environment.version || '1.0.0';
  }

  static getBuildTime(): string {
    return environment.buildTime || '';
  }

  static getEnvironment(): string {
    return environment.production ? 'production' : 'development';
  }

  static getAppName(): string {
    return 'SaaR Core Banking System';
  }

  static getVersionInfo(): VersionInfo {
    return {
      version: this.getAppVersion(),
      buildTime: this.getBuildTime(),
      environment: this.getEnvironment(),
      appName: this.getAppName()
    };
  }

  static getVersionString(): string {
    const version = this.getAppVersion();
    const buildTime = this.getBuildTime();
    const env = this.getEnvironment();
    
    let versionStr = `v${version}`;
    if (buildTime) {
      const buildDate = new Date(buildTime).toLocaleDateString();
      versionStr += ` (${buildDate})`;
    }
    if (!environment.production) {
      versionStr += ` [${env}]`;
    }
    
    return versionStr;
  }

  static getCopyrightString(): string {
    const currentYear = new Date().getFullYear();
    return `© ${currentYear} SaaR Banking Solutions`;
  }

  static generateCacheBustParam(): string {
    const version = this.getAppVersion();
    const buildTime = this.getBuildTime();
    return `v=${version}&t=${buildTime || Date.now()}`;
  }

  static addCacheBustToUrl(url: string): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${this.generateCacheBustParam()}`;
  }
}
