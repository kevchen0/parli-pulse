import type { HTMLAttributes } from 'react';

/**
 * MathML element types.
 *
 * React 19 renders MathML into the right namespace, but `@types/react` 19.2
 * declares no intrinsics for it, so TSX rejects `<mfrac>` on sight. These are
 * the elements the methodology page uses and no more -- a wholesale copy of the
 * MathML Core element list would be a maintenance surface for tags nobody
 * writes.
 *
 * Augments `React.JSX` rather than the global `JSX` namespace: React 19 moved
 * its intrinsics inside the module, and a global augmentation is a different
 * namespace that TS never consults while the module one exists.
 */
interface MathMLAttributes<T> extends HTMLAttributes<T> {
  /** `block` centres the equation on its own line; `inline` sets it in text. */
  display?: 'block' | 'inline';
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      math: MathMLAttributes<MathMLElement>;
      /** Identifier: a variable, set italic by default. */
      mi: MathMLAttributes<MathMLElement>;
      /** Number literal, set upright. */
      mn: MathMLAttributes<MathMLElement>;
      /** Operator, relation or fence, carrying MathML's operator spacing. */
      mo: MathMLAttributes<MathMLElement>;
      /** Upright text: function names and word-shaped subscripts. */
      mtext: MathMLAttributes<MathMLElement>;
      /** Groups terms into a single argument. */
      mrow: MathMLAttributes<MathMLElement>;
      /** Numerator over denominator. */
      mfrac: MathMLAttributes<MathMLElement>;
      /** Base with a subscript. */
      msub: MathMLAttributes<MathMLElement>;
      /** Base with an exponent. */
      msup: MathMLAttributes<MathMLElement>;
      /** Square root, drawn with a bar over the radicand. */
      msqrt: MathMLAttributes<MathMLElement>;
    }
  }
}
