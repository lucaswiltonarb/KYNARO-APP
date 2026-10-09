# Kynaro - PRD

## Overview
Mobile Expo wrapper for the Kynaro (FitCoach) web application. The web app is a fitness/nutrition/challenges platform built with React + Vite (frontend) and FastAPI + SQLAlchemy + SQLite (backend).

## Architecture
- **Port 3000**: Expo Metro (serves Expo Go mobile app)
- **Port 8001**: FitCoach Backend (FastAPI) + Built Vite SPA at `/api/app/` + Uploads at `/api/uploads/`
- **Engine**: Pose analysis engine at `/app/engine/` using MediaPipe

## Web App URL
`https://kynaro.preview.emergentagent.com/api/app/`

## Mobile App
Expo app wrapping the web URL in a WebView with camera permissions, file upload support, and Android back button handling.

## Key Features
- Login/Register with JWT auth
- Workouts management + AI generation
- Nutrition planning + meal logging + photo analysis
- Challenges system
- Camera-based exercise tracking (MediaPipe in browser)
- Video analysis (engine/MediaPipe on server)
- Admin panel for AI credentials and user management

## Tech Stack
- Frontend: React 18 + Vite 6 (built and served from FastAPI)
- Backend: FastAPI + SQLAlchemy + SQLite
- Engine: Python + MediaPipe 0.10.18
- Mobile: Expo SDK 57 + react-native-webview
