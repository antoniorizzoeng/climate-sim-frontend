import { WEBGL_UNAVAILABLE } from '@/lib/webgl';

/** Shown under a 3D failure when the browser refused a WebGL2 context. */
export function WebGLHelp({ error }: { error: string }) {
  if (error !== WEBGL_UNAVAILABLE) return null;
  return (
    <div className="webgl-help">
      <p>Your browser has WebGL2 turned off. To turn it on:</p>
      <ul>
        <li>
          <strong>Chrome or Edge:</strong> Settings › System › turn on “Use graphics
          acceleration when available”, then relaunch. If it is already on, quit the
          browser completely and reopen it, or update your graphics driver.
        </li>
        <li>
          <strong>Firefox or LibreWolf:</strong> in <code>about:config</code>, set{' '}
          <code>webgl.disabled</code> to <code>false</code>.
        </li>
        <li>
          <strong>Safari:</strong> update to Safari 15 or later.
        </li>
        <li>
          LibreWolf turns WebGL off by default; Settings › LibreWolf › Enable WebGL also
          works.
        </li>
        <li>
          Privacy extensions can block WebGL too; try a private window without them.
        </li>
      </ul>
    </div>
  );
}
