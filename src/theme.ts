import { createTheme } from "@material-ui/core/styles";

declare module "@material-ui/core/styles/createPalette" {
  interface Palette {
    baseColors: {
      blue: string;
      green: string;
      grayBorder: string;
      turquoise: string;
      white: string;
      red: string;
    };
  }
  interface PaletteOptions {
    baseColors?: {
      blue: string;
      green: string;
      grayBorder: string;
      turquoise: string;
      white: string;
      red: string;
    };
  }
}

const theme = createTheme({
  palette: {
    baseColors: {
      blue: "#3f51b5",
      green: "#3fb548",
      grayBorder: "#c4c4c4",
      turquoise: "#0d4a4d",
      white: "#fff",
      red: "#d62727",
    },
  },
  spacing: 5,
});

export default theme;
