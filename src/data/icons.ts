/**
 * Iconos que cambian de color entre modo claro y oscuro.
 *
 * Figma exporta cada SVG con el color ya aplicado, así que cada icono tiene
 * un archivo por modo (tomados de los frames claro y oscuro de "Single page 2").
 * `ThemedIcon` pinta los dos y el CSS oculta el que no corresponde.
 */

const T = '/assets/icons/themed';
const I = '/assets/icons';

export interface ThemedIconSource {
  light: string;
  dark: string;
  width: number;
  height: number;
}

export const THEMED_ICONS = {
  /** WhatsApp del botón del header. */
  'wa-header': { light: `${T}/wa22-light.svg`, dark: `${T}/wa22-dark.svg`, width: 22, height: 22 },
  /** WhatsApp sobre el botón principal (navy en claro, blanco en oscuro). */
  'wa-btn': { light: `${T}/wa24-light.svg`, dark: `${T}/wa24-dark.svg`, width: 24, height: 24 },
  /** WhatsApp sobre el botón de la tarjeta "Vender" (amarillo / blanco). */
  'wa-contrast': { light: `${T}/wa24-on-yellow.svg`, dark: `${T}/wa24-dark.svg`, width: 24, height: 24 },
  /** Flecha del botón con borde del hero. */
  'east-outline': { light: `${T}/east-light.svg`, dark: `${T}/east-dark.svg`, width: 24, height: 24 },
  /** Flecha de "Ver todas" y del CTA de valoración. */
  'east-soft': { light: `${T}/east-btn-light.svg`, dark: `${T}/east-btn-dark.svg`, width: 24, height: 24 },
  /** Flecha blanca sobre el botón de la tarjeta "Comprar" (igual en ambos). */
  'east-white': { light: `${I}/arrow-east.svg`, dark: `${I}/arrow-east.svg`, width: 24, height: 24 },
  plus: { light: `${T}/plus-light.svg`, dark: `${T}/plus-dark.svg`, width: 24, height: 24 },
  minus: { light: `${T}/minus-light.svg`, dark: `${T}/minus-dark.svg`, width: 24, height: 24 },
  checkbox: { light: `${T}/checkbox-light.svg`, dark: `${T}/checkbox-dark.svg`, width: 22, height: 22 },
  delete: { light: `${T}/delete-light.svg`, dark: `${T}/delete-dark.svg`, width: 24, height: 24 },
  'search-btn': { light: `${T}/search-light.svg`, dark: `${T}/search-dark.svg`, width: 24, height: 24 },

  /* Amenidades de la ficha */
  'amenity-elevator': { light: `${T}/amenity-elevator-light.svg`, dark: `${I}/amenity-elevator.svg`, width: 24, height: 24 },
  'amenity-pool': { light: `${T}/amenity-pool-light.svg`, dark: `${I}/amenity-pool.svg`, width: 24, height: 24 },
  'amenity-kids': { light: `${T}/amenity-kids-light.svg`, dark: `${I}/amenity-kids.svg`, width: 24, height: 24 },
  'amenity-pets': { light: `${T}/amenity-pets-light.svg`, dark: `${I}/amenity-pets.svg`, width: 24, height: 24 },
  'amenity-events': { light: `${T}/amenity-events-light.svg`, dark: `${I}/amenity-events-group.svg`, width: 24, height: 24 },
  'amenity-gym': { light: `${T}/amenity-gym-light.svg`, dark: `${I}/amenity-gym.svg`, width: 24, height: 24 },
} satisfies Record<string, ThemedIconSource>;

export type ThemedIconName = keyof typeof THEMED_ICONS;
