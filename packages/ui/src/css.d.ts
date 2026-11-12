// Plain CSS imports are bundled by Vite in the apps; TypeScript 6 checks side-effect imports.
declare module '*.css';
// `?raw` imports (tests only) give the stylesheet text.
declare module '*.css?raw' {
  const text: string;
  export default text;
}
