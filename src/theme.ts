import { createMuiTheme } from "@material-ui/core"
import { red, grey, green } from "@material-ui/core/colors"
import createPalette, { PaletteOptions } from "@material-ui/core/styles/createPalette"

declare module "@material-ui/core/styles/createPalette" {
  interface Palette {
    baseColors: {
      white: string
      black: string
      blue: string
      green: string
      success: string
      danger: string
      primary: string
      secondary: string
      disabled: string
      grayBorder: string
      turquoise: string
      red: string
      gray: string
    }
  }

  interface PaletteOptions {
    baseColors?: {
      white: string
      black: string
      blue: string
      green: string
      success: string
      danger: string
      primary: string
      secondary: string
      disabled: string
      grayBorder: string
      turquoise: string
      red: string
      gray: string
    }
  }
}

const palette = createPalette({
  baseColors: {
    white: "#FFF",
    black: "#000",
    blue: "#3f51b5",
    green: "#3fb548",
    success: green[500],
    danger: red[700],
    primary: "#3f51b5",
    secondary: "#ccc",
    disabled: grey[200],
    grayBorder: "#c4c4c4",
    turquoise: "#0d4a4d",
    red: "#d62727",
    gray: grey[100],
  },
})

export const commonTheme = createMuiTheme({
  typography: {
    fontFamily: [
      "Lato",
      "Roboto",
      "Arial",
      '"Helvetica Neue"',
      "sans-serif",
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(","),
    fontSize: 13,
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 800,
      md: 1024,
      lg: 1280,
      xl: 1920,
    },
  },
  palette,
  spacing: 5,
})

export default commonTheme
