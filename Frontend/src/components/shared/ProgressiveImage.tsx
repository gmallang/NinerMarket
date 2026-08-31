import { useState } from "react";
import type { ImgHTMLAttributes, ReactNode } from "react";
import s from "./ProgressiveImage.module.css";

interface ProgressiveImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "onLoad" | "onError"> {
  /** Optional overlay content (buttons, badges) positioned within the box. */
  children?: ReactNode;
}

/**
 * An <img> that shows a shimmering placeholder while the picture downloads,
 * then fades the real image in once it decodes, instead of leaving a blank
 * box on screen. The `className` is applied to the inner <img> so the caller's
 * existing image styling (object-fit, hover scale, border radius) keeps
 * working; the wrapper <span> only layers the shimmer behind it. Marked as a
 * drop-in replacement for a plain <img> (no layout changes required).
 */
export function ProgressiveImage({
  className,
  style,
  alt,
  children,
  ...rest
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <span className={s.wrap} style={style}>
      {!loaded && !errored && <span className={s.shimmer} aria-hidden="true" />}
      <img
        {...rest}
        alt={alt ?? ""}
        className={`${className ?? ""} ${s.image} ${loaded ? s.loaded : s.pending}`}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
      />
      {children}
    </span>
  );
}
