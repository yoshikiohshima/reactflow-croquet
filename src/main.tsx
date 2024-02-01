import React from 'react'
import ReactDOM from 'react-dom/client'
import {CroquetRoot, App as CroquetApp} from '@croquet/react';

import {FlowModel} from "./model.ts";
import FlowView from './view';

import './index.css';

function App() {
  const sessionParams = {
    name: import.meta.env["VITE_CROQUET_APP_NAME"] || CroquetApp.autoSession("q"),
    apiKey: import.meta.env["VITE_CROQUET_API_KEY"],
    tps: 0.5,
    appId: import.meta.env["VITE_CROQUET_APP_ID"] || "com.exawizards.flow",
    password: import.meta.env["VITE_CROQUET_PASSWORD"] || CroquetApp.autoPassword(),
    model: FlowModel,
    eventRateLimit: import.meta.env.EVENT_RATE_LIMIT || 60,
  };
  return (
    <CroquetRoot sessionParams={sessionParams}>
      <FlowView/>
    </CroquetRoot>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
      <App/>
  </React.StrictMode>,
)
