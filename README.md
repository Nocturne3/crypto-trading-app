# Crypto Trend Trading App

Web-Anwendung für Trend-Trading mit Kryptowährungen.

## Features

- Portfolio Übersicht (Tracking)
- Live Kurse (Top 50 Coins)
- Technische Analysen (MACD, RSI, EMA, SMA, Bollinger Bands, ADX, ATR)
- Buy/Sell Empfehlungen basierend auf Indikatoren
- Top Players (neue Listings + High Performer)
- Crypto Tabelle mit Buy/Sell Scores

## Setup

### Voraussetzungen
- Node.js (v18 oder höher)
- npm

### Installation

1. Dependencies installieren:
```bash
npm run install:all
```

2. Entwicklungsserver starten (Frontend + Backend):
```bash
npm run dev
```

Oder einzeln:
```bash
# Backend (Port 5000)
npm run dev:server

# Frontend (Port 3000)
npm run dev:client
```

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Express.js
- **API**: Binance API

## Projektstruktur

```
trading-app/
├── client/          # React Frontend
├── server/          # Express.js Backend
└── package.json     # Root Workspace
```

