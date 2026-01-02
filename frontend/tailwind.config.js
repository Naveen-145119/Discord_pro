export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        discord: {
          primary: '#5865F2',
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
        background: {
          primary: '#313338',
          secondary: '#2B2D31',
          tertiary: '#1E1F22',
          floating: '#111214',
          'user-panel': '#232428',
          modifier: {
            hover: 'rgba(79, 84, 92, 0.16)',
            active: 'rgba(79, 84, 92, 0.24)',
            selected: 'rgba(79, 84, 92, 0.32)',
          },
          'hover-solid': '#35373C',
          'active-solid': '#3F4147',
        },
        text: {
          normal: '#DBDEE1',
          muted: '#949BA4',
          heading: '#F2F3F5',
          link: '#00AFF4',
          positive: '#57F287',
          warning: '#FEE75C',
          danger: '#ED4245',
        },
        interactive: {
          normal: '#B5BAC1',
          hover: '#DBDEE1',
          active: '#FFFFFF',
          muted: '#4E5058',
        },
        channel: {
          icon: '#80848E',
          text: '#949BA4',
        },
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
        'tooltip-appear': 'tooltip-appear 0.1s ease-out forwards',
        'pill-grow': 'pill-grow 0.2s ease-out forwards',
        'discord-pulse': 'discord-pulse 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.15s ease-out',
        'slide-down': 'slide-down 0.15s ease-out',
        'fade-in': 'fade-in 0.1s ease-out',
      },
      keyframes: {
        'tooltip-appear': {
          '0%': { opacity: 0, transform: 'scale(0.95)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
        'pill-grow': {
          '0%': { height: 0, opacity: 0 },
          '100%': { height: '20px', opacity: 1 },
        },
        'discord-pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
        'slide-up': {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { opacity: 0, transform: 'translateY(-8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },
      transitionTimingFunction: {
        'discord': 'cubic-bezier(0.2, 0.0, 0, 1.0)',
      },
    },
  },
  plugins: [],
}

