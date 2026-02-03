declare module 'upng-js' {
  interface PNGImage {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    data: ArrayBuffer;
  }

  function decode(buffer: ArrayBuffer): PNGImage;
  function toRGBA8(img: PNGImage): ArrayBuffer[];
  function encode(
    imgs: ArrayBuffer[],
    w: number,
    h: number,
    cnum: number,
    dels?: number[]
  ): ArrayBuffer;

  export { decode, toRGBA8, encode, PNGImage };
  export default { decode, toRGBA8, encode };
}
