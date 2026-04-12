// Browser stub for node:zlib — just-bash/browser imports gunzipSync/gzipSync
// only for the gzip/gunzip/zcat commands which are documented as unsupported
// in browser environments. All other just-bash commands work fine without this.
export function gunzipSync(): never {
  throw new Error('gunzip is not supported in the browser');
}
export function gzipSync(): never {
  throw new Error('gzip is not supported in the browser');
}
export default { gunzipSync, gzipSync };
