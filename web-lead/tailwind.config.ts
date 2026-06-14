import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        lead: {
          navy:    '#030C40',
          blue:    '#7957F2',
          gold:    '#D93240',
          light:   '#f3f0ff',
          red:     '#D93240',
          crimson: '#BF2A52',
          magenta: '#A6249D',
          violet:  '#7957F2',
        },
      },
      backgroundImage: {
        'lead-gradient': 'linear-gradient(135deg, #030C40 0%, #7957F2 50%, #BF2A52 100%)',
      },
    },
  },
  plugins: [],
}

export default config
