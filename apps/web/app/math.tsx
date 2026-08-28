import type { ReactNode } from 'react';

/**
 * Thin wrappers over MathML, so equations are typeset rather than drawn.
 *
 * The methodology page previously built formulas out of styled spans, which
 * puts a fraction bar and a superscript wherever CSS happens to leave them and
 * renders a square root as the character √ with nothing over the radicand.
 * MathML is laid out by the browser's own math engine: fractions stack,
 * exponents sit where exponents sit, and a radical gets a bar of the right
 * width. It is native in every current browser, needs no script or stylesheet,
 * and so survives the strict asset policy the site runs under.
 *
 * These are deliberately close to the MathML they emit. A DSL that hid the
 * distinction between an identifier and an operator would produce the spacing
 * bugs this exists to avoid -- MathML spaces `<mo>` and `<mi>` differently, and
 * that spacing is most of what makes an equation readable.
 */

/** An equation. `block` centres it on its own line. */
export function E({ children, block }: { children: ReactNode; block?: boolean }) {
  return (
    <math display={block ? 'block' : 'inline'} className={block ? 'eq' : 'eqi'}>
      {block ? <mrow>{children}</mrow> : children}
    </math>
  );
}

/** An identifier: a variable name, set in the italic MathML uses for them. */
export const V = ({ children }: { children: ReactNode }) => <mi>{children}</mi>;

/** A number. Upright, and never spaced as though it were an operator. */
export const N = ({ children }: { children: ReactNode }) => <mn>{children}</mn>;

/** An operator, relation, or fence. Carries MathML's operator spacing. */
export const Op = ({ children }: { children: ReactNode }) => <mo>{children}</mo>;

/** Upright multi-letter text: function names, word subscripts. */
export const Text = ({ children }: { children: ReactNode }) => <mtext>{children}</mtext>;

/** Groups terms so a fraction or exponent takes all of them, not just the last. */
export const Row = ({ children }: { children: ReactNode }) => <mrow>{children}</mrow>;

/** Numerator over denominator. Exactly two children. */
export const Frac = ({ children }: { children: ReactNode }) => <mfrac>{children}</mfrac>;

/** Base then subscript. Exactly two children. */
export const Sub = ({ children }: { children: ReactNode }) => <msub>{children}</msub>;

/** Base then exponent. Exactly two children. */
export const Sup = ({ children }: { children: ReactNode }) => <msup>{children}</msup>;

/** A square root, with a bar drawn over the whole radicand. */
export const Sqrt = ({ children }: { children: ReactNode }) => (
  <msqrt>
    <mrow>{children}</mrow>
  </msqrt>
);
