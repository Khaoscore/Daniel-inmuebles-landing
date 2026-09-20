/**
 * Datos de marca y navegación.
 * Tomados del diseño de Figma "Web Daniel Inmuebles".
 */

export const WHATSAPP_NUMBER = '573117318970';
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

export const BRAND = {
  name: 'Daniel Inmuebles',
  legalName: 'Romac Bogota',
  instagram: '@danielinmueblesbogota',
  city: 'Bogotá',
} as const;

export const CONTACT = {
  phone: `+${WHATSAPP_NUMBER}`,
  phoneDisplay: '+57 311 731 8970',
  whatsappUrl: WHATSAPP_URL,
  instagram: '@danielinmueblesbogota',
  instagramUrl: 'https://www.instagram.com/danielinmueblesbogota',
  email: 'danielinmueblesbogota@gmail.com',
} as const;

export interface NavLink {
  label: string;
  href: string;
}

export const NAV_LINKS: NavLink[] = [
  { label: 'Propiedades', href: '/propiedades' },
  { label: 'Sobre nosotros', href: '/#equipo' },
];

export const SOCIAL_LINKS = [
  // Variante blanca del icono: la de los botones amarillos es azul oscuro.
  { label: 'WhatsApp', href: WHATSAPP_URL, icon: '/assets/icons/whatsapp-social.svg' },
  {
    label: 'Instagram',
    href: 'https://instagram.com/danielinmueblesbogota',
    icon: '/assets/icons/instagram.svg',
  },
  {
    label: 'TikTok',
    href: 'https://tiktok.com/@danielinmueblesbogota',
    icon: '/assets/icons/tiktok.svg',
  },
  {
    label: 'Facebook',
    href: 'https://facebook.com/danielinmueblesbogota',
    icon: '/assets/icons/facebook.svg',
  },
] as const;

/** Columna izquierda de enlaces del footer. */
export const FOOTER_LINKS_PRIMARY: NavLink[] = [
  { label: 'Propiedades destacadas', href: '/#destacadas' },
  { label: 'Comprar o vender', href: '/#comprar-vender' },
  { label: 'Sobre nosotros', href: '/#equipo' },
  { label: 'Servicios', href: '/#servicios' },
];

/** Columna derecha de enlaces del footer. */
export const FOOTER_LINKS_SECONDARY: NavLink[] = [
  { label: 'Propiedades destacadas', href: '/#destacadas' },
  { label: 'Comprar o vender', href: '/#comprar-vender' },
  { label: 'Sobre nosotros', href: '/#equipo' },
];

export const LEGAL_LINKS: NavLink[] = [
  { label: 'Política de privacidad', href: '/politica-de-privacidad' },
  { label: 'Términos y condiciones', href: '/terminos-y-condiciones' },
  { label: 'Cookies', href: '/cookies' },
];
