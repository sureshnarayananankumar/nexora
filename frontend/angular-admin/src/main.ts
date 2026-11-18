import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Replaced at build time via angular.json "define": false normally, true in the "demo" configuration,
// so normal builds drop the demo module entirely.
declare const NEXORA_DEMO: boolean;

async function start() {
  if (NEXORA_DEMO) {
    // Demo build only (GitHub Pages): answer API calls in the browser with sample data.
    const { installDemoApi } = await import('../../demo-api/demo-api.js');
    installDemoApi({ banner: 'Live demo with sample data · sign in with the prefilled account · changes stay in this tab' });
  }
  await bootstrapApplication(App, appConfig);
}

start().catch((err) => console.error(err));
