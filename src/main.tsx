import React from 'react'
import ReactDOM from 'react-dom/client'

import {FlowModel} from "./model.ts";
import {FlowApp, FlowView} from './view';

import {App as CroquetApp} from "@croquet/react";

import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
      <FlowApp sessionParams={
          {
              name: import.meta.env["VITE_CROQUET_APP_NAME"] || CroquetApp.autoSession("q"),
              apiKey: import.meta.env["VITE_CROQUET_API_KEY"],
              tps: 0.5,
              appId: import.meta.env["VITE_CROQUET_APP_ID"] || "com.exawizards.flow",
              password: import.meta.env["VITE_CROQUET_PASSWORD"] || CroquetApp.autoPassword(),
              model: FlowModel,
              eventRateLimit: import.meta.env.EVENT_RATE_LIMIT || 60,
          }}/>
  </React.StrictMode>,
)
