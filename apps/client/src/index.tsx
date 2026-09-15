import "@fontsource-variable/archivo";
import "@fontsource-variable/manrope";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/800.css";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";

import App from "./App";
import store from "./services/redux";

import "./index.css";

const element = document.getElementById("root");
const root = ReactDOM.createRoot(element!);

root.render(
  <Provider store={store}>
    <App />
  </Provider>,
);
