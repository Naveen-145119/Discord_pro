/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Discord color palette
        discord: {
          primary: '#5865F2',    // Blurple
          green: '#57F287',
          yellow: '#FEE75C',
          fuchsia: '#EB459E',
          red: '#ED4245',
          'not-quite-black': '#23272A',
          'dark-but-not-black': '#2C2F33',
          greyple: '#99AAB5',
          blurple: '#5865F2',
          'full-white': '#FFFFFF',
        },
        // App backgrounds
        background: {
          primary: '#313338',
          secondary: '#2B2D31',
          tertiary: '#1E1F22',
          floating: '#111214',
          modifier: {
            hover: 'rgba(79, 84, 92, 0.16)',
            active: 'rgba(79, 84, 92, 0.24)',
            selected: 'rgba(79, 84, 92, 0.32)',
          },
        },
        // Text colors
        text: {
          normal: '#DBDEE1',
          muted: '#949BA4',
          heading: '#F2F3F5',
          link: '#00AFF4',
          positive: '#57F287',
          warning: '#FEE75C',
          danger: '#ED4245',
        },
        // Interactive elements
        interactive: {
          normal: '#B5BAC1',
          hover: '#DBDEE1',
          active: '#FFFFFF',
          muted: '#4E5058',
        },
        // Channel colors
        channel: {
          icon: '#80848E',
          text: '#949BA4',
        },
        // Status colors
        status: {
          online: '#23A55A',
          idle: '#F0B232',
          dnd: '#F23F43',
          offline: '#80848E',
          streaming: '#593695',
        },
      },
      fontFamily: {
        sans: ['gg sans', 'Noto Sans', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['Consolas', 'Andale Mono WT', 'Andale Mono', 'Lucida Console', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        'xl': '0.9375rem',
      },
      boxShadow: {
        'elevation-low': '0 1px 0 rgba(4, 4, 5, 0.2), 0 1.5px 0 rgba(6, 6, 7, 0.05), 0 2px 0 rgba(4, 4, 5, 0.05)',
        'elevation-medium': '0 4px 4px rgba(0, 0, 0, 0.16)',
        'elevation-high': '0 8px 16px rgba(0, 0, 0, 0.24)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
