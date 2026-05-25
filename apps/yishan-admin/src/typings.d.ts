declare const __APP_BASE__: string;

declare module 'mockjs';

declare module '*.less' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '@public/icons/*';
declare module '@public/images/*';
declare module '@public/*' {
  const src: string;
  export default src;
}
