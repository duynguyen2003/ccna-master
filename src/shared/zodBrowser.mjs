// CRA treats Zod's CommonJS entry (`index.cjs`) as a static asset when it is
// loaded with require(). Use the ESM entry for the browser bundle instead.
import { z } from 'zod';

export { z };
