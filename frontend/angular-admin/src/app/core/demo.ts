// Set to true only by the "demo" build configuration (GitHub Pages), via angular.json "define".
declare const NEXORA_DEMO: boolean | undefined;

/** True only in the GitHub Pages demo build, which answers API calls in the browser with sample data. */
export const IS_DEMO = typeof NEXORA_DEMO !== 'undefined' && NEXORA_DEMO;
