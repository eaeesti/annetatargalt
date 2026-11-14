/** Images imported in app.tsx are bundled and resolve to their URL. */
declare module "*.png" {
  const src: string;
  export default src;
}
