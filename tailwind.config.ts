import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        // Tokens semánticos Faro VE — paleta accesible AAA daltonismo-friendly
        minor: '#7c3aed', // menores no acompañados — prioridad máxima
        medical: '#ea580c', // condición médica urgente
        missing: '#dc2626', // desaparecidos normal
        sighting: '#eab308', // avistamientos sin confirmar
        deceased: '#1f2937', // cuerpos NN / morgues
        safe: '#16a34a', // "estoy a salvo"
        shelter: '#0B4F6C', // refugios activos — azul faro (brand)
        aid: '#06b6d4', // puntos de ayuda
        search: '#92400e', // búsquedas activas (polígono)
        closed: '#9ca3af', // cerrados / inactivos
        faro: {
          50: '#f0f9fb',
          100: '#dbf0f6',
          200: '#bce1ed',
          300: '#8ccadf',
          400: '#52a9c9',
          500: '#358cb1',
          600: '#2f7295',
          700: '#2c5d7a',
          800: '#2a4e65',
          900: '#0B4F6C' // primary
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif'
        ]
      },
      animation: {
        // La animación late en el HALO de luz (.faro-glow), no en el núcleo,
        // así el color del pin queda quieto y legible mientras "respira" la luz.
        'pulse-minor': 'pulse-minor 2.4s ease-in-out infinite',
        'pulse-medical': 'pulse-medical 1.4s ease-in-out infinite',
        'glow-breath': 'glow-breath 4.5s ease-in-out infinite',
        'fade-in': 'fade-in 0.45s ease-out',
        'ripple': 'ripple 0.6s ease-out'
      },
      keyframes: {
        // respiración: el halo inhala/exhala; el núcleo queda quieto y legible
        'pulse-minor': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.85' },
          '50%': { transform: 'scale(1.35)', opacity: '0.45' }
        },
        'pulse-medical': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.90' },
          '50%': { transform: 'scale(1.30)', opacity: '0.50' }
        },
        // respiración muy tenue para desaparecido/avistamiento (casi imperceptible)
        'glow-breath': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.80' },
          '50%': { transform: 'scale(1.12)', opacity: '0.62' }
        },
        // "encenderse": el a-salvo aparece como una luz que prende
        'fade-in': {
          from: { opacity: '0', transform: 'scale(0.6)' },
          to: { opacity: '1', transform: 'scale(1)' }
        },
        // anillo de faro (beacon) para el "apareció a salvo" en realtime
        ripple: {
          from: { transform: 'scale(0.8)', opacity: '0.6' },
          to: { transform: 'scale(2.6)', opacity: '0' }
        }
      },
      minHeight: {
        tap: '44px' // a11y mínimo tap target
      },
      minWidth: {
        tap: '44px'
      }
    }
  },
  plugins: [forms]
} satisfies Config;
