/**
 * Host Loader entry.
 *
 * The plugin contributes nothing on the host side: the shortcuts run in the
 * browser half (lib/client.js), which the Web client module system loads from
 * the `dsh.client` declaration in package.json.
 */
export function apply() {}
