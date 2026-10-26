# NetMaster artwork

Source: the user-provided `Logo NetMastery@1x.png` (960 × 540). The artwork itself reads **NetMaster**; application names and ordinary text remain NetMastery.

- `netmaster-logo.png`: complete, tightly cropped artwork with transparent background, suitable for reuse/import into Figma.
- `netmaster-mark.png` and `netmaster-wordmark.png`: aligned slices with identical canvas height. Per the user's sizing preference, `BrandLogo` displays the mark at 20% and the wordmark at 65% of its container width. On dark surfaces CSS makes the wordmark white while preserving the colored icon. On small headers/collapsed sidebars only the mark is displayed.
- Browser/app icons are in `public/brand/`, with transparent backgrounds and centered square canvases. They are declared as `any`, not maskable icons.

Figma was discoverable but not connected during this change. A built-in imagegen background-extraction draft was inspected and rejected because it introduced edge noise. Final assets were extracted deterministically from the original raster using its flat background/text palette, preserving the white/cyan details inside the purple icon; no text was retyped. Cropping/resizing used System.Drawing locally. The final source image was not overwritten.

Imagegen draft prompt: remove only the pale blue-gray background; output transparent PNG; preserve the purple network icon, white/cyan details, navy/blue “NetMaster” wordmark and “HỌC MẠNG ĐỂ ĐI LÀM”; no redesign, retyping, extra letters or shadows; crop with small transparent padding. That generated draft is not referenced by the application.
