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
        'pulse-minor': 'pulse-minor 2s ease-in-out infinite',
        'pulse-medical': 'pulse-medical 1.2s ease-in-out infinite',
        'fade-in': 'fade-in 0.4s ease-out',
        'ripple': 'ripple 0.6s ease-out'
      },
      keyframes: {
        'pulse-minor': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.15)', opacity: '0.85' }
        },
        'pulse-medical': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.18)', opacity: '0.82' }
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        ripple: {
          from: { transform: 'scale(0)', opacity: '0.5' },
          to: { transform: 'scale(2.4)', opacity: '0' }
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
